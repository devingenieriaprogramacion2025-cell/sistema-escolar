const ApiError = require('../utils/ApiError');
const { parsePagination, isValidObjectId } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { ROLES } = require('../constants/roles');
const { query, one, scalar } = require('../services/sql.service');

const getFiltersByRole = (req) => {
  const filters = [];
  const params = {};

  if (req.user.role === ROLES.DOCENTE) {
    filters.push('ir.requester_id = @requesterId');
    params.requesterId = Number(req.user.id);
  }

  return { filters, params };
};

const mapRequestRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  title: row.title,
  description: row.description,
  priority: row.priority,
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

const listInternalRequests = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = getFiltersByRole(req);
  const filters = [...scope.filters];
  const params = { ...scope.params, skip, limit };

  if (req.query.status) {
    filters.push('UPPER(ir.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      ir.id, ir.requester_id, ir.title, ir.description, ir.priority, ir.reviewed_by,
      ir.review_comments, ir.status, ir.created_at, ir.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.internal_requests ir
    INNER JOIN dbo.users req_u ON req_u.id = ir.requester_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = ir.reviewed_by
    ${whereClause}
    ORDER BY ir.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.internal_requests ir
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: items.map(mapRequestRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

const createInternalRequest = async (req, res, next) => {
  const { title, description, priority } = req.body;
  if (!title || !description) {
    return next(new ApiError(400, 'title y description son requeridos'));
  }

  await query(
    `
    INSERT INTO dbo.internal_requests
    (requester_id, title, description, priority, reviewed_by, review_comments, status, created_at, updated_at)
    VALUES
    (@requesterId, @title, @description, @priority, NULL, '', 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      requesterId: Number(req.user.id),
      title,
      description,
      priority: (priority || 'MEDIUM').toUpperCase()
    }
  );

  const internalRequest = await one(
    `
    SELECT TOP 1
      ir.id, ir.requester_id, ir.title, ir.description, ir.priority, ir.reviewed_by,
      ir.review_comments, ir.status, ir.created_at, ir.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.internal_requests ir
    INNER JOIN dbo.users req_u ON req_u.id = ir.requester_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = ir.reviewed_by
    WHERE ir.requester_id = @requesterId
    ORDER BY ir.id DESC;
    `,
    { requesterId: Number(req.user.id) }
  );

  await audit({
    req,
    action: 'CREAR_SOLICITUD_INTERNA',
    module: 'SOLICITUDES',
    entityId: String(internalRequest.id),
    details: { priority: internalRequest.priority }
  });

  res.status(201).json({ success: true, data: mapRequestRow(internalRequest) });
};

const reviewInternalRequest = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de solicitud invalido'));
  }

  const { status, reviewComments } = req.body;
  const normalizedStatus = (status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedStatus)) {
    return next(new ApiError(400, 'Estado invalido para revision. Solo se permite APPROVED o REJECTED'));
  }

  const requestId = Number(req.params.id);
  const internalRequest = await one(
    'SELECT id, status FROM dbo.internal_requests WHERE id = @id;',
    { id: requestId }
  );

  if (!internalRequest) {
    return next(new ApiError(404, 'Solicitud no encontrada'));
  }

  if (internalRequest.status !== 'PENDING') {
    return next(new ApiError(409, 'Solo solicitudes pendientes pueden aprobarse o rechazarse'));
  }

  await query(
    `
    UPDATE dbo.internal_requests
    SET status = @status,
        reviewed_by = @reviewedBy,
        review_comments = @reviewComments,
        updated_at = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: requestId,
      status: normalizedStatus,
      reviewedBy: Number(req.user.id),
      reviewComments: reviewComments || ''
    }
  );

  const updated = await one(
    `
    SELECT
      ir.id, ir.requester_id, ir.title, ir.description, ir.priority, ir.reviewed_by,
      ir.review_comments, ir.status, ir.created_at, ir.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.internal_requests ir
    INNER JOIN dbo.users req_u ON req_u.id = ir.requester_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = ir.reviewed_by
    WHERE ir.id = @id;
    `,
    { id: requestId }
  );

  await audit({
    req,
    action: 'REVISAR_SOLICITUD_INTERNA',
    module: 'SOLICITUDES',
    entityId: String(requestId),
    details: { status: normalizedStatus }
  });

  res.json({ success: true, data: mapRequestRow(updated) });
};

module.exports = {
  listInternalRequests,
  createInternalRequest,
  reviewInternalRequest
};

