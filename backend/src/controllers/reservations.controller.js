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

const mapReservationRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  purpose: row.proposito,
  proposito: row.proposito,
  startDate: row.fecha_inicio,
  endDate: row.fecha_fin,
  reviewComments: row.comentarios_revision,
  status: row.estado,
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
  resource: row.recurso_id
    ? {
        _id: String(row.recurso_id),
        id: String(row.recurso_id),
        name: row.resource_nombre,
        nombre: row.resource_nombre,
        code: row.resource_codigo,
        codigo: row.resource_codigo,
        area: row.resource_area
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

const getReservationFiltersByRole = async (req) => {
  const filters = [];
  const params = {};

  if (req.user.role === ROLES.ENCARGADO) {
    if (normalizeText(req.user.area) !== 'BIBLIOTECA') {
      filters.push('res.area = @roleArea');
      params.roleArea = req.user.area;
    }
  }

  return { filters, params };
};

const listReservations = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = await getReservationFiltersByRole(req);
  const filters = [...scope.filters];
  const params = { ...scope.params, skip, limit };

  if (req.query.estado) {
    filters.push('UPPER(rv.estado) = @estado');
    params.estado = req.query.estado.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      rv.id, rv.solicitante_id, rv.recurso_id, rv.proposito, rv.fecha_inicio, rv.fecha_fin, rv.revisado_por,
      rv.comentarios_revision, rv.estado, rv.creado_en, rv.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.reservas rv
    INNER JOIN dbo.usuarios req_u ON req_u.id = rv.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = rv.revisado_por
    ${whereClause}
    ORDER BY rv.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.reservas rv
    INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: items.map(mapReservationRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

const createReservation = async (req, res, next) => {
  const resourceId = req.body.resourceId || req.body.recurso_id;
  const proposito = req.body.proposito || req.body.purpose;
  const startDate = req.body.startDate || req.body.fecha_inicio;
  const endDate = req.body.endDate || req.body.fecha_fin;
  const requesterId = req.body.requesterId || req.body.solicitante_id;
  if (!resourceId || !proposito || !startDate || !endDate) {
    return next(new ApiError(400, 'resourceId, proposito, startDate y endDate son requeridos'));
  }

  if (!isValidObjectId(resourceId)) {
    return next(new ApiError(400, 'resourceId invalido'));
  }

  const resource = await one(
    'SELECT id, codigo, estado FROM dbo.recursos WHERE id = @id;',
    { id: Number(resourceId) }
  );
  if (!resource || resource.estado !== 'ACTIVE') {
    return next(new ApiError(400, 'Recurso no valido'));
  }

  const starts = new Date(startDate);
  const ends = new Date(endDate);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return next(new ApiError(400, 'Rango de fechas invalido'));
  }

  const finalRequesterId = req.user.role === ROLES.DOCENTE ? req.user.id : requesterId || req.user.id;
  if (!isValidObjectId(finalRequesterId)) {
    return next(new ApiError(400, 'requesterId invalido'));
  }

  const requester = await one(
    'SELECT id, estado FROM dbo.usuarios WHERE id = @id;',
    { id: Number(finalRequesterId) }
  );
  if (!requester || requester.estado !== 'ACTIVE') {
    return next(new ApiError(400, 'Solicitante no valido'));
  }

  await query(
    `
    INSERT INTO dbo.reservas
    (solicitante_id, recurso_id, proposito, fecha_inicio, fecha_fin, revisado_por, comentarios_revision, estado, creado_en, actualizado_en)
    VALUES
    (@requesterId, @resourceId, @proposito, @startDate, @endDate, NULL, '', 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      requesterId: Number(finalRequesterId),
      resourceId: Number(resourceId),
      proposito,
      startDate: starts,
      endDate: ends
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      rv.id, rv.solicitante_id, rv.recurso_id, rv.proposito, rv.fecha_inicio, rv.fecha_fin, rv.revisado_por,
      rv.comentarios_revision, rv.estado, rv.creado_en, rv.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.reservas rv
    INNER JOIN dbo.usuarios req_u ON req_u.id = rv.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = rv.revisado_por
    WHERE rv.solicitante_id = @requesterId AND rv.recurso_id = @resourceId
    ORDER BY rv.id DESC;
    `,
    { requesterId: Number(finalRequesterId), resourceId: Number(resourceId) }
  );

  await audit({
    req,
    accion: 'CREAR_RESERVA',
    modulo: 'RESERVAS',
    entityId: String(created.id),
    detalles: { resource: resource.codigo, period: `${startDate} - ${endDate}` }
  });

  res.status(201).json({ success: true, data: mapReservationRow(created) });
};

const reviewReservation = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de reserva invalido'));
  }

  const estado = req.body.estado || req.body.status;
  const reviewComments = req.body.reviewComments ?? req.body.comentarios_revision;
  const normalizedStatus = (estado || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedStatus)) {
    return next(new ApiError(400, 'estado debe ser APPROVED o REJECTED'));
  }

  const reservationId = Number(req.params.id);
  const reservation = await one(
    `
    SELECT id, recurso_id, estado, fecha_inicio, fecha_fin
    FROM dbo.reservas
    WHERE id = @id;
    `,
    { id: reservationId }
  );

  if (!reservation) {
    return next(new ApiError(404, 'Reserva no encontrada'));
  }

  if (reservation.estado !== 'PENDING') {
    return next(new ApiError(409, 'Solo reservas pendientes pueden revisarse'));
  }

  if (normalizedStatus === 'APPROVED') {
    const conflict = await one(
      `
      SELECT TOP 1 id
      FROM dbo.reservas
      WHERE id <> @id
        AND recurso_id = @resourceId
        AND estado = 'APPROVED'
        AND fecha_inicio < @endDate
        AND fecha_fin > @startDate;
      `,
      {
        id: reservationId,
        resourceId: reservation.recurso_id,
        startDate: reservation.fecha_inicio,
        endDate: reservation.fecha_fin
      }
    );

    if (conflict) {
      return next(new ApiError(409, 'Existe una reserva aprobada en ese rango horario'));
    }
  }

  await query(
    `
    UPDATE dbo.reservas
    SET estado = @estado,
        comentarios_revision = @reviewComments,
        revisado_por = @reviewedBy,
        actualizado_en = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: reservationId,
      estado: normalizedStatus,
      reviewComments: reviewComments || '',
      reviewedBy: Number(req.user.id)
    }
  );

  const updated = await one(
    `
    SELECT
      rv.id, rv.solicitante_id, rv.recurso_id, rv.proposito, rv.fecha_inicio, rv.fecha_fin, rv.revisado_por,
      rv.comentarios_revision, rv.estado, rv.creado_en, rv.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.reservas rv
    INNER JOIN dbo.usuarios req_u ON req_u.id = rv.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = rv.revisado_por
    WHERE rv.id = @id;
    `,
    { id: reservationId }
  );

  await audit({
    req,
    accion: 'REVISAR_RESERVA',
    modulo: 'RESERVAS',
    entityId: String(reservationId),
    detalles: { estado: normalizedStatus }
  });

  res.json({ success: true, data: mapReservationRow(updated) });
};

const cancelReservation = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de reserva invalido'));
  }

  const reservationId = Number(req.params.id);
  const reservation = await one(
    `
    SELECT id, solicitante_id, revisado_por, comentarios_revision, estado
    FROM dbo.reservas
    WHERE id = @id;
    `,
    { id: reservationId }
  );
  if (!reservation) {
    return next(new ApiError(404, 'Reserva no encontrada'));
  }

  const isOwner = String(reservation.solicitante_id) === req.user.id;
  const canCancel = req.user.role === ROLES.ADMIN || req.user.role === ROLES.INSPECTORIA || isOwner;
  if (!canCancel) {
    return next(new ApiError(403, 'No tienes permisos para cancelar esta reserva'));
  }

  if (!['PENDING', 'APPROVED'].includes(reservation.estado)) {
    return next(new ApiError(409, 'La reserva no puede cancelarse en su estado actual'));
  }

  await query(
    `
    UPDATE dbo.reservas
    SET estado = 'CANCELLED',
        comentarios_revision = @reviewComments,
        revisado_por = @reviewedBy,
        actualizado_en = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: reservationId,
      reviewComments: req.body.reason || reservation.comentarios_revision,
      reviewedBy: reservation.revisado_por || Number(req.user.id)
    }
  );

  const updated = await one(
    `
    SELECT
      rv.id, rv.solicitante_id, rv.recurso_id, rv.proposito, rv.fecha_inicio, rv.fecha_fin, rv.revisado_por,
      rv.comentarios_revision, rv.estado, rv.creado_en, rv.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      rev_u.nombre AS revisado_por_nombre, rev_u.email AS revisado_por_email
    FROM dbo.reservas rv
    INNER JOIN dbo.usuarios req_u ON req_u.id = rv.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
    LEFT JOIN dbo.usuarios rev_u ON rev_u.id = rv.revisado_por
    WHERE rv.id = @id;
    `,
    { id: reservationId }
  );

  await audit({
    req,
    accion: 'CANCELAR_RESERVA',
    modulo: 'RESERVAS',
    entityId: String(reservationId),
    detalles: { by: req.user.role }
  });

  res.json({ success: true, data: mapReservationRow(updated) });
};

module.exports = {
  listReservations,
  createReservation,
  reviewReservation,
  cancelReservation
};






