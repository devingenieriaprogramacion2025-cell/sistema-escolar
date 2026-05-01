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
  purpose: row.purpose,
  startDate: row.start_date,
  endDate: row.end_date,
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
  resource: row.resource_id
    ? {
        _id: String(row.resource_id),
        id: String(row.resource_id),
        name: row.resource_name,
        code: row.resource_code,
        area: row.resource_area
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

  if (req.query.status) {
    filters.push('UPPER(rv.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      rv.id, rv.requester_id, rv.resource_id, rv.purpose, rv.start_date, rv.end_date, rv.reviewed_by,
      rv.review_comments, rv.status, rv.created_at, rv.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.reservations rv
    INNER JOIN dbo.users req_u ON req_u.id = rv.requester_id
    INNER JOIN dbo.resources res ON res.id = rv.resource_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = rv.reviewed_by
    ${whereClause}
    ORDER BY rv.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.reservations rv
    INNER JOIN dbo.resources res ON res.id = rv.resource_id
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
  const { resourceId, purpose, startDate, endDate, requesterId } = req.body;
  if (!resourceId || !purpose || !startDate || !endDate) {
    return next(new ApiError(400, 'resourceId, purpose, startDate y endDate son requeridos'));
  }

  if (!isValidObjectId(resourceId)) {
    return next(new ApiError(400, 'resourceId invalido'));
  }

  const resource = await one(
    'SELECT id, code, status FROM dbo.resources WHERE id = @id;',
    { id: Number(resourceId) }
  );
  if (!resource || resource.status !== 'ACTIVE') {
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
    'SELECT id, status FROM dbo.users WHERE id = @id;',
    { id: Number(finalRequesterId) }
  );
  if (!requester || requester.status !== 'ACTIVE') {
    return next(new ApiError(400, 'Solicitante no valido'));
  }

  await query(
    `
    INSERT INTO dbo.reservations
    (requester_id, resource_id, purpose, start_date, end_date, reviewed_by, review_comments, status, created_at, updated_at)
    VALUES
    (@requesterId, @resourceId, @purpose, @startDate, @endDate, NULL, '', 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      requesterId: Number(finalRequesterId),
      resourceId: Number(resourceId),
      purpose,
      startDate: starts,
      endDate: ends
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      rv.id, rv.requester_id, rv.resource_id, rv.purpose, rv.start_date, rv.end_date, rv.reviewed_by,
      rv.review_comments, rv.status, rv.created_at, rv.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.reservations rv
    INNER JOIN dbo.users req_u ON req_u.id = rv.requester_id
    INNER JOIN dbo.resources res ON res.id = rv.resource_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = rv.reviewed_by
    WHERE rv.requester_id = @requesterId AND rv.resource_id = @resourceId
    ORDER BY rv.id DESC;
    `,
    { requesterId: Number(finalRequesterId), resourceId: Number(resourceId) }
  );

  await audit({
    req,
    action: 'CREAR_RESERVA',
    module: 'RESERVAS',
    entityId: String(created.id),
    details: { resource: resource.code, period: `${startDate} - ${endDate}` }
  });

  res.status(201).json({ success: true, data: mapReservationRow(created) });
};

const reviewReservation = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de reserva invalido'));
  }

  const { status, reviewComments } = req.body;
  const normalizedStatus = (status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedStatus)) {
    return next(new ApiError(400, 'status debe ser APPROVED o REJECTED'));
  }

  const reservationId = Number(req.params.id);
  const reservation = await one(
    `
    SELECT id, resource_id, status, start_date, end_date
    FROM dbo.reservations
    WHERE id = @id;
    `,
    { id: reservationId }
  );

  if (!reservation) {
    return next(new ApiError(404, 'Reserva no encontrada'));
  }

  if (reservation.status !== 'PENDING') {
    return next(new ApiError(409, 'Solo reservas pendientes pueden revisarse'));
  }

  if (normalizedStatus === 'APPROVED') {
    const conflict = await one(
      `
      SELECT TOP 1 id
      FROM dbo.reservations
      WHERE id <> @id
        AND resource_id = @resourceId
        AND status = 'APPROVED'
        AND start_date < @endDate
        AND end_date > @startDate;
      `,
      {
        id: reservationId,
        resourceId: reservation.resource_id,
        startDate: reservation.start_date,
        endDate: reservation.end_date
      }
    );

    if (conflict) {
      return next(new ApiError(409, 'Existe una reserva aprobada en ese rango horario'));
    }
  }

  await query(
    `
    UPDATE dbo.reservations
    SET status = @status,
        review_comments = @reviewComments,
        reviewed_by = @reviewedBy,
        updated_at = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: reservationId,
      status: normalizedStatus,
      reviewComments: reviewComments || '',
      reviewedBy: Number(req.user.id)
    }
  );

  const updated = await one(
    `
    SELECT
      rv.id, rv.requester_id, rv.resource_id, rv.purpose, rv.start_date, rv.end_date, rv.reviewed_by,
      rv.review_comments, rv.status, rv.created_at, rv.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.reservations rv
    INNER JOIN dbo.users req_u ON req_u.id = rv.requester_id
    INNER JOIN dbo.resources res ON res.id = rv.resource_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = rv.reviewed_by
    WHERE rv.id = @id;
    `,
    { id: reservationId }
  );

  await audit({
    req,
    action: 'REVISAR_RESERVA',
    module: 'RESERVAS',
    entityId: String(reservationId),
    details: { status: normalizedStatus }
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
    SELECT id, requester_id, reviewed_by, review_comments, status
    FROM dbo.reservations
    WHERE id = @id;
    `,
    { id: reservationId }
  );
  if (!reservation) {
    return next(new ApiError(404, 'Reserva no encontrada'));
  }

  const isOwner = String(reservation.requester_id) === req.user.id;
  const canCancel = req.user.role === ROLES.ADMIN || req.user.role === ROLES.INSPECTORIA || isOwner;
  if (!canCancel) {
    return next(new ApiError(403, 'No tienes permisos para cancelar esta reserva'));
  }

  if (!['PENDING', 'APPROVED'].includes(reservation.status)) {
    return next(new ApiError(409, 'La reserva no puede cancelarse en su estado actual'));
  }

  await query(
    `
    UPDATE dbo.reservations
    SET status = 'CANCELLED',
        review_comments = @reviewComments,
        reviewed_by = @reviewedBy,
        updated_at = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    {
      id: reservationId,
      reviewComments: req.body.reason || reservation.review_comments,
      reviewedBy: reservation.reviewed_by || Number(req.user.id)
    }
  );

  const updated = await one(
    `
    SELECT
      rv.id, rv.requester_id, rv.resource_id, rv.purpose, rv.start_date, rv.end_date, rv.reviewed_by,
      rv.review_comments, rv.status, rv.created_at, rv.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      rev_u.name AS reviewed_by_name, rev_u.email AS reviewed_by_email
    FROM dbo.reservations rv
    INNER JOIN dbo.users req_u ON req_u.id = rv.requester_id
    INNER JOIN dbo.resources res ON res.id = rv.resource_id
    LEFT JOIN dbo.users rev_u ON rev_u.id = rv.reviewed_by
    WHERE rv.id = @id;
    `,
    { id: reservationId }
  );

  await audit({
    req,
    action: 'CANCELAR_RESERVA',
    module: 'RESERVAS',
    entityId: String(reservationId),
    details: { by: req.user.role }
  });

  res.json({ success: true, data: mapReservationRow(updated) });
};

module.exports = {
  listReservations,
  createReservation,
  reviewReservation,
  cancelReservation
};

