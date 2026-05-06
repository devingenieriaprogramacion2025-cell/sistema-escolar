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

const getUserRole = (user) => user?.rol || user?.role || '';
const isLibraryManager = (user) => getUserRole(user) === ROLES.ENCARGADO && normalizeText(user.area) === 'BIBLIOTECA';

const getFiltersByRole = (req) => {
  const filters = [];
  const params = {};
  if (req.user.role === ROLES.DOCENTE) {
    filters.push('p.solicitante_id = @requesterId');
    params.requesterId = Number(req.user.id);
  }
  return { filters, params };
};

const mapPrintRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  documentName: row.nombre_documento,
  nombre_documento: row.nombre_documento,
  pages: row.paginas,
  paginas: row.paginas,
  copies: row.copias,
  copias: row.copias,
  color: Boolean(row.es_color),
  es_color: Boolean(row.es_color),
  doubleSided: Boolean(row.doble_cara),
  status: row.estado,
  reviewComments: row.comentarios_revision,
  estado: row.estado,
  createdAt: row.creado_en,
  updatedAt: row.actualizado_en,
  requester: row.solicitante_id
    ? {
        _id: String(row.solicitante_id),
        id: String(row.solicitante_id),
        name: row.requester_nombre,
        nombre: row.requester_nombre,
        email: row.requester_email,
        area: row.requester_area
      }
    : null,
  reviewedBy: row.revisado_por
    ? {
        _id: String(row.revisado_por),
        id: String(row.revisado_por),
        name: row.revisado_por_nombre,
        nombre: row.revisado_por_nombre,
        email: row.revisado_por_email
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

  if (req.query.estado) {
    filters.push('UPPER(p.estado) = @estado');
    params.estado = req.query.estado.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      p.id, p.solicitante_id, p.nombre_documento, p.paginas, p.copias, p.es_color, p.doble_cara,
      p.revisado_por, p.comentarios_revision, p.estado, p.creado_en, p.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.solicitudes_impresion p
    INNER JOIN dbo.usuarios req_u ON req_u.id = p.solicitante_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = p.revisado_por
    ${whereClause}
    ORDER BY p.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.solicitudes_impresion p
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

  const documentName = (req.body.documentName || req.body.nombre_documento || '').trim();
  const paginas = req.body.paginas ?? req.body.pages;
  const copias = req.body.copias ?? req.body.copies;
  const es_color = req.body.es_color ?? req.body.color;
  const doubleSided = req.body.doubleSided ?? req.body.doble_cara;

  if (!documentName || !paginas || !copias) {
    return next(new ApiError(400, 'documentName, paginas y copias son requeridos'));
  }

  const pageCount = Number(paginas);
  const copyCount = Number(copias);
  if (pageCount <= 0 || copyCount <= 0) {
    return next(new ApiError(400, 'paginas y copias deben ser mayores que 0'));
  }

  await query(
    `
    INSERT INTO dbo.solicitudes_impresion
    (solicitante_id, nombre_documento, paginas, copias, es_color, doble_cara, revisado_por, comentarios_revision, estado, creado_en, actualizado_en)
    VALUES
    (@requesterId, @documentName, @paginas, @copias, @es_color, @doubleSided, NULL, '', 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      requesterId: Number(req.user.id),
      documentName,
      paginas: pageCount,
      copias: copyCount,
      es_color: Boolean(es_color),
      doubleSided: Boolean(doubleSided)
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      p.id, p.solicitante_id, p.nombre_documento, p.paginas, p.copias, p.es_color, p.doble_cara,
      p.revisado_por, p.comentarios_revision, p.estado, p.creado_en, p.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.solicitudes_impresion p
    INNER JOIN dbo.usuarios req_u ON req_u.id = p.solicitante_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = p.revisado_por
    WHERE p.solicitante_id = @requesterId
    ORDER BY p.id DESC;
    `,
    { requesterId: Number(req.user.id) }
  );

  await audit({
    req,
    accion: 'CREAR_SOLICITUD_IMPRESION',
    modulo: 'IMPRESIONES',
    entityId: String(created.id),
    detalles: { paginas: pageCount, copias: copyCount }
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

  const estado = req.body.estado || req.body.status;
  const reviewComments = req.body.reviewComments ?? req.body.comentarios_revision;
  const normalizedStatus = (estado || '').toUpperCase();
  if (!['APPROVED', 'REJECTED', 'DONE'].includes(normalizedStatus)) {
    return next(new ApiError(400, 'Estado invalido para revision'));
  }

  const printId = Number(req.params.id);
  const printRequest = await one('SELECT id, estado FROM dbo.solicitudes_impresion WHERE id = @id;', { id: printId });
  if (!printRequest) {
    return next(new ApiError(404, 'Solicitud de impresion no encontrada'));
  }

  if (printRequest.estado !== 'PENDING') {
    return next(new ApiError(409, 'Solo solicitudes pendientes pueden revisarse'));
  }

  await query(
    `
    UPDATE dbo.solicitudes_impresion
    SET estado = @estado,
        comentarios_revision = @reviewComments,
        revisado_por = @reviewedBy,
        actualizado_en = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: printId,
      estado: normalizedStatus,
      reviewComments: reviewComments || '',
      reviewedBy: Number(req.user.id)
    }
  );

  const updated = await one(
    `
    SELECT
      p.id, p.solicitante_id, p.nombre_documento, p.paginas, p.copias, p.es_color, p.doble_cara,
      p.revisado_por, p.comentarios_revision, p.estado, p.creado_en, p.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.solicitudes_impresion p
    INNER JOIN dbo.usuarios req_u ON req_u.id = p.solicitante_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = p.revisado_por
    WHERE p.id = @id;
    `,
    { id: printId }
  );

  await audit({
    req,
    accion: 'REVISAR_SOLICITUD_IMPRESION',
    modulo: 'IMPRESIONES',
    entityId: String(printId),
    detalles: { estado: normalizedStatus }
  });

  res.json({ success: true, data: mapPrintRow(updated) });
};

module.exports = {
  listPrintRequests,
  createPrintRequest,
  reviewPrintRequest
};






