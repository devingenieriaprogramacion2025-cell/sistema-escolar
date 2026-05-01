const PDFDocument = require('pdfkit');
const { isValidObjectId } = require('../utils/validators');
const { ROLES } = require('../constants/roles');
const { query, scalar } = require('../services/sql.service');

const buildScopedFilters = async (req, rawQuery) => {
  const filters = {
    resource: [],
    loan: [],
    reservation: [],
    request: [],
    print: []
  };

  const params = {};

  const fromDate = rawQuery.from ? new Date(rawQuery.from) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    filters.loan.push('l.created_at >= @fromDate');
    filters.reservation.push('rv.created_at >= @fromDate');
    filters.request.push('ir.created_at >= @fromDate');
    filters.print.push('pr.created_at >= @fromDate');
    params.fromDate = fromDate;
  }

  const toDate = rawQuery.to ? new Date(rawQuery.to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    toDate.setHours(23, 59, 59, 999);
    filters.loan.push('l.created_at <= @toDate');
    filters.reservation.push('rv.created_at <= @toDate');
    filters.request.push('ir.created_at <= @toDate');
    filters.print.push('pr.created_at <= @toDate');
    params.toDate = toDate;
  }

  if (req.user.role === ROLES.DOCENTE) {
    filters.loan.push('l.requester_id = @scopeUserId');
    filters.reservation.push('rv.requester_id = @scopeUserId');
    filters.request.push('ir.requester_id = @scopeUserId');
    filters.print.push('pr.requester_id = @scopeUserId');
    params.scopeUserId = Number(req.user.id);
  }

  if (req.user.role === ROLES.ENCARGADO) {
    filters.resource.push('r.area = @scopeArea');
    filters.loan.push('res.area = @scopeArea');
    filters.reservation.push('res.area = @scopeArea');
    params.scopeArea = req.user.area;
  }

  if (rawQuery.userId && isValidObjectId(rawQuery.userId)) {
    filters.loan.push('l.requester_id = @queryUserId');
    filters.reservation.push('rv.requester_id = @queryUserId');
    filters.request.push('ir.requester_id = @queryUserId');
    filters.print.push('pr.requester_id = @queryUserId');
    params.queryUserId = Number(rawQuery.userId);
  }

  if (rawQuery.resourceId && isValidObjectId(rawQuery.resourceId)) {
    filters.loan.push('l.resource_id = @queryResourceId');
    filters.reservation.push('rv.resource_id = @queryResourceId');
    params.queryResourceId = Number(rawQuery.resourceId);
  }

  return { filters, params };
};

const buildSummary = async (req) => {
  const { filters, params } = await buildScopedFilters(req, req.query);

  const resourceWhere = filters.resource.length ? `WHERE ${filters.resource.join(' AND ')}` : '';
  const loanWhere = filters.loan.length ? `WHERE ${filters.loan.join(' AND ')}` : '';
  const reservationWhere = filters.reservation.length ? `WHERE ${filters.reservation.join(' AND ')}` : '';
  const requestWhere = filters.request.length ? `WHERE ${filters.request.join(' AND ')}` : '';
  const printWhere = filters.print.length ? `WHERE ${filters.print.join(' AND ')}` : '';

  const [
    totalResources,
    activeLoans,
    totalLoans,
    pendingReservations,
    totalReservations,
    totalInternalRequests,
    pendingInternalRequests,
    totalPrintRequests,
    pendingPrintRequests,
    totalPrintedPages,
    topResources
  ] = await Promise.all([
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.resources r
      ${resourceWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.loans l
      INNER JOIN dbo.resources res ON res.id = l.resource_id
      ${loanWhere ? `${loanWhere} AND l.status IN ('ACTIVE', 'OVERDUE')` : "WHERE l.status IN ('ACTIVE', 'OVERDUE')"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.loans l
      INNER JOIN dbo.resources res ON res.id = l.resource_id
      ${loanWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.reservations rv
      INNER JOIN dbo.resources res ON res.id = rv.resource_id
      ${reservationWhere ? `${reservationWhere} AND rv.status = 'PENDING'` : "WHERE rv.status = 'PENDING'"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.reservations rv
      INNER JOIN dbo.resources res ON res.id = rv.resource_id
      ${reservationWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.internal_requests ir
      ${requestWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.internal_requests ir
      ${requestWhere ? `${requestWhere} AND ir.status IN ('PENDING', 'IN_PROGRESS')` : "WHERE ir.status IN ('PENDING', 'IN_PROGRESS')"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.print_requests pr
      ${printWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.print_requests pr
      ${printWhere ? `${printWhere} AND pr.status = 'PENDING'` : "WHERE pr.status = 'PENDING'"};
      `,
      params
    ),
    scalar(
      `
      SELECT ISNULL(SUM(pr.pages * pr.copies), 0) AS pages
      FROM dbo.print_requests pr
      ${printWhere};
      `,
      params
    ),
    query(
      `
      SELECT TOP 5
        l.resource_id AS resource_id,
        res.name AS resource_name,
        res.code AS resource_code,
        SUM(l.quantity) AS total_quantity
      FROM dbo.loans l
      INNER JOIN dbo.resources res ON res.id = l.resource_id
      ${loanWhere}
      GROUP BY l.resource_id, res.name, res.code
      ORDER BY total_quantity DESC;
      `,
      params
    )
  ]);

  return {
    period: {
      from: req.query.from || null,
      to: req.query.to || null
    },
    totals: {
      resources: Number(totalResources || 0),
      loans: Number(totalLoans || 0),
      activeLoans: Number(activeLoans || 0),
      reservations: Number(totalReservations || 0),
      pendingReservations: Number(pendingReservations || 0),
      internalRequests: Number(totalInternalRequests || 0),
      pendingInternalRequests: Number(pendingInternalRequests || 0),
      printRequests: Number(totalPrintRequests || 0),
      pendingPrintRequests: Number(pendingPrintRequests || 0),
      totalPrintedPages: Number(totalPrintedPages || 0)
    },
    topResources: topResources.map((item) => ({
      resourceId: String(item.resource_id),
      resourceName: item.resource_name,
      resourceCode: item.resource_code,
      totalQuantity: Number(item.total_quantity)
    }))
  };
};

const getSummaryReport = async (req, res) => {
  const summary = await buildSummary(req);
  res.json({ success: true, data: summary });
};

const exportSummaryPdf = async (req, res) => {
  const summary = await buildSummary(req);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const fileName = `reporte-sistema-escolar-${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

  doc.pipe(res);

  doc.fontSize(16).text('Sistema Web de Gestion Escolar', { align: 'left' });
  doc.fontSize(12).text('Reporte general de operaciones', { align: 'left' });
  doc.moveDown(1);

  doc.fontSize(10).text(`Generado por: ${req.user.name} (${req.user.role})`);
  doc.text(`Fecha de generacion: ${new Date().toLocaleString()}`);
  doc.text(`Rango: ${summary.period.from || 'sin inicio'} - ${summary.period.to || 'sin termino'}`);
  doc.moveDown(1);

  doc.fontSize(12).text('Totales', { underline: true });
  Object.entries(summary.totals).forEach(([key, value]) => {
    doc.fontSize(10).text(`${key}: ${value}`);
  });

  doc.moveDown(1);
  doc.fontSize(12).text('Top recursos por prestamos', { underline: true });

  if (summary.topResources.length === 0) {
    doc.fontSize(10).text('No existen datos en el rango solicitado.');
  } else {
    summary.topResources.forEach((item, index) => {
      doc.fontSize(10).text(`${index + 1}. ${item.resourceName} (${item.resourceCode}) - ${item.totalQuantity}`);
    });
  }

  doc.end();
};

module.exports = {
  getSummaryReport,
  exportSummaryPdf
};

