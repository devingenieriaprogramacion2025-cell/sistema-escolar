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
    filters.loan.push('l.creado_en >= @fromDate');
    filters.reservation.push('rv.creado_en >= @fromDate');
    filters.request.push('ir.creado_en >= @fromDate');
    filters.print.push('pr.creado_en >= @fromDate');
    params.fromDate = fromDate;
  }

  const toDate = rawQuery.to ? new Date(rawQuery.to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    toDate.setHours(23, 59, 59, 999);
    filters.loan.push('l.creado_en <= @toDate');
    filters.reservation.push('rv.creado_en <= @toDate');
    filters.request.push('ir.creado_en <= @toDate');
    filters.print.push('pr.creado_en <= @toDate');
    params.toDate = toDate;
  }

  if (req.user.role === ROLES.DOCENTE) {
    filters.loan.push('l.solicitante_id = @scopeUserId');
    filters.reservation.push('rv.solicitante_id = @scopeUserId');
    filters.request.push('ir.solicitante_id = @scopeUserId');
    filters.print.push('pr.solicitante_id = @scopeUserId');
    params.scopeUserId = Number(req.user.id);
  }

  if (req.user.role === ROLES.ENCARGADO) {
    filters.resource.push('r.area = @scopeArea');
    filters.loan.push('res.area = @scopeArea');
    filters.reservation.push('res.area = @scopeArea');
    params.scopeArea = req.user.area;
  }

  if (rawQuery.userId && isValidObjectId(rawQuery.userId)) {
    filters.loan.push('l.solicitante_id = @queryUserId');
    filters.reservation.push('rv.solicitante_id = @queryUserId');
    filters.request.push('ir.solicitante_id = @queryUserId');
    filters.print.push('pr.solicitante_id = @queryUserId');
    params.queryUserId = Number(rawQuery.userId);
  }

  if (rawQuery.resourceId && isValidObjectId(rawQuery.resourceId)) {
    filters.loan.push('l.recurso_id = @queryResourceId');
    filters.reservation.push('rv.recurso_id = @queryResourceId');
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
      FROM dbo.recursos r
      ${resourceWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.prestamos l
      INNER JOIN dbo.recursos res ON res.id = l.recurso_id
      ${loanWhere ? `${loanWhere} AND l.estado IN ('ACTIVE', 'OVERDUE')` : "WHERE l.estado IN ('ACTIVE', 'OVERDUE')"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.prestamos l
      INNER JOIN dbo.recursos res ON res.id = l.recurso_id
      ${loanWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.reservas rv
      INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
      ${reservationWhere ? `${reservationWhere} AND rv.estado = 'PENDING'` : "WHERE rv.estado = 'PENDING'"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.reservas rv
      INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
      ${reservationWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.solicitudes_internas ir
      ${requestWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.solicitudes_internas ir
      ${requestWhere ? `${requestWhere} AND ir.estado IN ('PENDING', 'IN_PROGRESS')` : "WHERE ir.estado IN ('PENDING', 'IN_PROGRESS')"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.solicitudes_impresion pr
      ${printWhere};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.solicitudes_impresion pr
      ${printWhere ? `${printWhere} AND pr.estado = 'PENDING'` : "WHERE pr.estado = 'PENDING'"};
      `,
      params
    ),
    scalar(
      `
      SELECT ISNULL(SUM(pr.paginas * pr.copias), 0) AS paginas
      FROM dbo.solicitudes_impresion pr
      ${printWhere};
      `,
      params
    ),
    query(
      `
      SELECT TOP 5
        l.recurso_id AS recurso_id,
        res.nombre AS resource_nombre,
        res.codigo AS resource_codigo,
        SUM(l.cantidad) AS cantidad_total
      FROM dbo.prestamos l
      INNER JOIN dbo.recursos res ON res.id = l.recurso_id
      ${loanWhere}
      GROUP BY l.recurso_id, res.nombre, res.codigo
      ORDER BY cantidad_total DESC;
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
      resourceId: String(item.recurso_id),
      resourceName: item.resource_nombre,
      resourceCode: item.resource_codigo,
      totalQuantity: Number(item.cantidad_total)
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

  doc.fontSize(10).text(`Generado por: ${req.user.nombre} (${req.user.role})`);
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






