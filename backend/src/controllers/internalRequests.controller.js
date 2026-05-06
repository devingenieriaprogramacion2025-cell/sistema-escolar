const ApiError = require('../utils/ApiError');
const { parsePagination, isValidObjectId } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { ROLES } = require('../constants/roles');
const { query, one, scalar } = require('../services/sql.service');

const getFiltersByRole = (req) => {
  const filters = [];
  const params = {};

  if (req.user.role === ROLES.DOCENTE) {
    filters.push('ir.solicitante_id = @requesterId');
    params.requesterId = Number(req.user.id);
  }

  return { filters, params };
};

const mapRequestRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  titulo: row.titulo,
  descripcion: row.descripcion,
  prioridad: row.prioridad,
  reviewComments: row.comentarios_revision,
  estado: row.estado,
  createdAt: row.creado_en,
  updatedAt: row.actualizado_en,
  requester: row.solicitante_id
    ? {
        _id: String(row.solicitante_id),
        id: String(row.solicitante_id),
        nombre: row.requester_nombre,
        email: row.requester_email,
        area: row.requester_area
      }
    : null,
  reviewedBy: row.revisado_por
    ? {
        _id: String(row.revisado_por),
        id: String(row.revisado_por),
        nombre: row.revisado_por_nombre,
        email: row.revisado_por_email
      }
    : null
});

const listInternalRequests = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = getFiltersByRole(req);
  const filters = [...scope.filters];
  const params = { ...scope.params, skip, limit };

  if (req.query.estado) {
    filters.push('UPPER(ir.estado) = @estado');
    params.estado = req.query.estado.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      ir.id, ir.solicitante_id, ir.titulo, ir.descripcion, ir.prioridad, ir.revisado_por,
      ir.comentarios_revision, ir.estado, ir.creado_en, ir.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.solicitudes_internas ir
    INNER JOIN dbo.usuarios req_u ON req_u.id = ir.solicitante_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = ir.revisado_por
    ${whereClause}
    ORDER BY ir.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.solicitudes_internas ir
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
  const { titulo, descripcion, prioridad } = req.body;
  if (!titulo || !descripcion) {
    return next(new ApiError(400, 'titulo y descripcion son requeridos'));
  }

  await query(
    `
    INSERT INTO dbo.solicitudes_internas
    (solicitante_id, titulo, descripcion, prioridad, revisado_por, comentarios_revision, estado, creado_en, actualizado_en)
    VALUES
    (@requesterId, @titulo, @descripcion, @prioridad, NULL, '', 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      requesterId: Number(req.user.id),
      titulo,
      descripcion,
      prioridad: (prioridad || 'MEDIUM').toUpperCase()
    }
  );

  const internalRequest = await one(
    `
    SELECT TOP 1
      ir.id, ir.solicitante_id, ir.titulo, ir.descripcion, ir.prioridad, ir.revisado_por,
      ir.comentarios_revision, ir.estado, ir.creado_en, ir.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.solicitudes_internas ir
    INNER JOIN dbo.usuarios req_u ON req_u.id = ir.solicitante_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = ir.revisado_por
    WHERE ir.solicitante_id = @requesterId
    ORDER BY ir.id DESC;
    `,
    { requesterId: Number(req.user.id) }
  );

  await audit({
    req,
    accion: 'CREAR_SOLICITUD_INTERNA',
    modulo: 'SOLICITUDES',
    entityId: String(internalRequest.id),
    detalles: { prioridad: internalRequest.prioridad }
  });

  res.status(201).json({ success: true, data: mapRequestRow(internalRequest) });
};

const reviewInternalRequest = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de solicitud invalido'));
  }

  const { estado, reviewComments } = req.body;
  const normalizedStatus = (estado || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedStatus)) {
    return next(new ApiError(400, 'Estado invalido para revision. Solo se permite APPROVED o REJECTED'));
  }

  const requestId = Number(req.params.id);
  const internalRequest = await one(
    'SELECT id, estado FROM dbo.solicitudes_internas WHERE id = @id;',
    { id: requestId }
  );

  if (!internalRequest) {
    return next(new ApiError(404, 'Solicitud no encontrada'));
  }

  if (internalRequest.estado !== 'PENDING') {
    return next(new ApiError(409, 'Solo solicitudes pendientes pueden aprobarse o rechazarse'));
  }

  await query(
    `
    UPDATE dbo.solicitudes_internas
    SET estado = @estado,
        revisado_por = @reviewedBy,
        comentarios_revision = @reviewComments,
        actualizado_en = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: requestId,
      estado: normalizedStatus,
      reviewedBy: Number(req.user.id),
      reviewComments: reviewComments || ''
    }
  );

  const updated = await one(
    `
    SELECT
      ir.id, ir.solicitante_id, ir.titulo, ir.descripcion, ir.prioridad, ir.revisado_por,
      ir.comentarios_revision, ir.estado, ir.creado_en, ir.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.solicitudes_internas ir
    INNER JOIN dbo.usuarios req_u ON req_u.id = ir.solicitante_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = ir.revisado_por
    WHERE ir.id = @id;
    `,
    { id: requestId }
  );

  await audit({
    req,
    accion: 'REVISAR_SOLICITUD_INTERNA',
    modulo: 'SOLICITUDES',
    entityId: String(requestId),
    detalles: { estado: normalizedStatus }
  });

  res.json({ success: true, data: mapRequestRow(updated) });
};

module.exports = {
  listInternalRequests,
  createInternalRequest,
  reviewInternalRequest
};






