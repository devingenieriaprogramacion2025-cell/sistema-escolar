const ApiError = require('../utils/ApiError');
const { parsePagination, isValidObjectId } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { ROLES } = require('../constants/roles');
const { query, one, scalar } = require('../services/sql.service');

const normalizeText = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const isLibraryManager = (user) => user?.role === ROLES.ENCARGADO && normalizeText(user.area) === 'BIBLIOTECA';

const getFiltersByRole = (req) => {
  const filters = [];
  const params = {};
  if (req.user.role === ROLES.DOCENTE) {
    filters.push('p.requester_id = @requesterId');
    params.requesterId = Number(req.user.id);
  }
  return { filters, params };
};

const mapPrintRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  documentName: row.document_name,
  pages: row.pages,
  copies: row.copies,
  color: Boolean(row.color),
  doubleSided: Boolean(row.double_sided),
  reviewComments: row.review_comments,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  requester: row.requester_id
    ? {
        _id: String(row.requester_id),
        id: String(row.requester_id),
        name: row.requester_name,
        email: row.requester_email,
        area: row.requester_area
      }
    : null,
  reviewedBy: row.reviewed_by
    ? {
        _id: String(row.reviewed_by),
        id: String(row.reviewed_by),
        name: row.reviewed_by_name,
        email: row.reviewed_by_email
      }
    : null
});

const listPrintRequests = async (req, res, next) => {
  if (req.user.role === ROLES.ENCARGADO && !isLibraryManager(req.user)) {
    return next(new ApiError(403, 'Solo el Encargado de Biblioteca puede gestionar impresiones pendientes'));
  }

  const { page, limit, skip } = parsePagination(req.query);
  const scope = getFiltersByRole(req);
  const filters = [...scope.filters];
  const params = { ...scope.params, skip, limit };

  if (req.query.status) {
    filters.push('UPPER(p.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      p.id, p.requester_id, p.document_name, p.pages, p.copies, p.color, p.double_sided,
      p.reviewed_by, p.review_comments, p.status, p.created_at, p.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.print_requests p
    INNER JOIN dbo.users req_u ON req_u.id = p.requester_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = p.reviewed_by
    ${whereClause}
    ORDER BY p.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.print_requests p
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: items.map(mapPrintRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

const createPrintRequest = async (req, res, next) => {
  if (req.user.role === ROLES.ENCARGADO && !isLibraryManager(req.user)) {
    return next(new ApiError(403, 'Solo el Encargado de Biblioteca puede crear solicitudes de impresion'));
  }

  const { documentName, pages, copies, color, doubleSided } = req.body;
  if (!documentName || !pages || !copies) {
    return next(new ApiError(400, 'documentName, pages y copies son requeridos'));
  }

  const pageCount = Number(pages);
  const copyCount = Number(copies);
  if (pageCount <= 0 || copyCount <= 0) {
    return next(new ApiError(400, 'pages y copies deben ser mayores que 0'));
  }

  await query(
    `
    INSERT INTO dbo.print_requests
    (requester_id, document_name, pages, copies, color, double_sided, reviewed_by, review_comments, status, created_at, updated_at)
    VALUES
    (@requesterId, @documentName, @pages, @copies, @color, @doubleSided, NULL, '', 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      requesterId: Number(req.user.id),
      documentName,
      pages: pageCount,
      copies: copyCount,
      color: Boolean(color),
      doubleSided: Boolean(doubleSided)
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      p.id, p.requester_id, p.document_name, p.pages, p.copies, p.color, p.double_sided,
      p.reviewed_by, p.review_comments, p.status, p.created_at, p.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.print_requests p
    INNER JOIN dbo.users req_u ON req_u.id = p.requester_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = p.reviewed_by
    WHERE p.requester_id = @requesterId
    ORDER BY p.id DESC;
    `,
    { requesterId: Number(req.user.id) }
  );

  await audit({
    req,
    action: 'CREAR_SOLICITUD_IMPRESION',
    module: 'IMPRESIONES',
    entityId: String(created.id),
    details: { pages: pageCount, copies: copyCount }
  });

  res.status(201).json({ success: true, data: mapPrintRow(created) });
};

const reviewPrintRequest = async (req, res, next) => {
  if (!isLibraryManager(req.user)) {
    return next(new ApiError(403, 'Solo el Encargado de Biblioteca puede gestionar impresiones pendientes'));
  }

  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de impresion invalido'));
  }

  const { status, reviewComments } = req.body;
  const normalizedStatus = (status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED', 'DONE'].includes(normalizedStatus)) {
    return next(new ApiError(400, 'Estado invalido para revision'));
  }

  const printId = Number(req.params.id);
  const printRequest = await one('SELECT id, status FROM dbo.print_requests WHERE id = @id;', { id: printId });
  if (!printRequest) {
    return next(new ApiError(404, 'Solicitud de impresion no encontrada'));
  }

  if (printRequest.status !== 'PENDING') {
    return next(new ApiError(409, 'Solo solicitudes pendientes pueden revisarse'));
  }

  await query(
    `
    UPDATE dbo.print_requests
    SET status = @status,
        review_comments = @reviewComments,
        reviewed_by = @reviewedBy,
        updated_at = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: printId,
      status: normalizedStatus,
      reviewComments: reviewComments || '',
      reviewedBy: Number(req.user.id)
    }
  );

  const updated = await one(
    `
    SELECT
      p.id, p.requester_id, p.document_name, p.pages, p.copies, p.color, p.double_sided,
      p.reviewed_by, p.review_comments, p.status, p.created_at, p.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.print_requests p
    INNER JOIN dbo.users req_u ON req_u.id = p.requester_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = p.reviewed_by
    WHERE p.id = @id;
    `,
    { id: printId }
  );

  await audit({
    req,
    action: 'REVISAR_SOLICITUD_IMPRESION',
    module: 'IMPRESIONES',
    entityId: String(printId),
    details: { status: normalizedStatus }
  });

  res.json({ success: true, data: mapPrintRow(updated) });
};

module.exports = {
  listPrintRequests,
  createPrintRequest,
  reviewPrintRequest
};

