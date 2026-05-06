const ApiError = require('../utils/ApiError');
const { parsePagination, isValidObjectId } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { ROLES } = require('../constants/roles');
const { query, one, scalar, withTransaction } = require('../services/sql.service');

const LOAN_REQUESTER_NAMES = Object.freeze([
  '1 Basico',
  '2 Basico',
  '3 Basico',
  '4 Basico',
  '5 Basico',
  '6 Basico',
  '7 Basico',
  '8 Basico',
  'Profesores',
  'Administrativos'
]);

const normalizeText = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const allowedRequesterNamesSet = new Set(LOAN_REQUESTER_NAMES.map((nombre) => normalizeText(nombre)));

const getUserRole = (user) => user?.rol || user?.role || '';
const isLibraryManager = (user) => getUserRole(user) === ROLES.ENCARGADO && normalizeText(user.area) === 'BIBLIOTECA';

const mapLoanRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  quantity: row.cantidad,
  cantidad: row.cantidad,
  startDate: row.fecha_inicio,
  dueDate: row.fecha_vencimiento,
  returnedDate: row.fecha_devolucion,
  comments: row.comentarios,
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
  approvedBy: row.aprobado_por
    ? {
        _id: String(row.aprobado_por),
        id: String(row.aprobado_por),
        name: row.aprobado_por_nombre,
        nombre: row.aprobado_por_nombre,
        email: row.aprobado_por_email
      }
    : null
});

const getLoanFiltersByRole = async (req) => {
  const filters = [];
  const params = {};

  if (getUserRole(req.user) === ROLES.ENCARGADO) {
    filters.push('res.area = @roleArea');
    params.roleArea = req.user.area;
  }

  return { filters, params };
};

const listLoans = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = await getLoanFiltersByRole(req);
  const filters = [...scope.filters];
  const params = { ...scope.params, skip, limit };

  if (req.query.estado) {
    filters.push('UPPER(l.estado) = @estado');
    params.estado = req.query.estado.toUpperCase();
  }

  if (req.query.requesterId && isValidObjectId(req.query.requesterId)) {
    filters.push('l.solicitante_id = @requesterId');
    params.requesterId = Number(req.query.requesterId);
  }

  if (req.query.resourceId && isValidObjectId(req.query.resourceId)) {
    filters.push('l.recurso_id = @resourceId');
    params.resourceId = Number(req.query.resourceId);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await query(
    `
    SELECT
      l.id, l.solicitante_id, l.recurso_id, l.cantidad, l.fecha_inicio, l.fecha_vencimiento, l.fecha_devolucion,
      l.comentarios, l.aprobado_por, l.estado, l.creado_en, l.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      app_u.nombre AS aprobado_por_nombre, app_u.email AS aprobado_por_email
    FROM dbo.prestamos l
    INNER JOIN dbo.usuarios req_u ON req_u.id = l.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    LEFT JOIN dbo.usuarios app_u ON app_u.id = l.aprobado_por
    ${whereClause}
    ORDER BY l.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.prestamos l
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: rows.map(mapLoanRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

const createLoan = async (req, res, next) => {
  if (!isLibraryManager(req.user)) {
    return next(new ApiError(403, 'Solo el Encargado de Biblioteca puede generar prestamos'));
  }

  const requesterId = req.body.requesterId;
  const resourceId = req.body.resourceId || req.body.recurso_id;
  const cantidad = req.body.cantidad ?? req.body.quantity;
  const dueDate = req.body.dueDate || req.body.fecha_vencimiento;
  const comentarios = req.body.comentarios ?? req.body.comments;
  if (!resourceId || !cantidad || !dueDate) {
    return next(new ApiError(400, 'resourceId, cantidad y dueDate son requeridos'));
  }

  if (!isValidObjectId(resourceId)) {
    return next(new ApiError(400, 'resourceId invalido'));
  }

  if (requesterId && !isValidObjectId(requesterId)) {
    return next(new ApiError(400, 'requesterId invalido'));
  }

  const finalRequesterId = Number(requesterId || req.user.id);
  const resourceDbId = Number(resourceId);
  const cantidadNumber = Number(cantidad);
  if (cantidadNumber <= 0) {
    return next(new ApiError(400, 'La cantidad debe ser mayor a 0'));
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return next(new ApiError(400, 'dueDate invalido'));
  }

  const requester = await one(
    `
    SELECT u.id, u.nombre, u.email, u.estado, r.nombre AS role_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    WHERE u.id = @id;
    `,
    { id: finalRequesterId }
  );

  if (!requester || requester.estado !== 'ACTIVE') {
    return next(new ApiError(400, 'Solicitante no valido'));
  }

  const isCurrentUserRequester = String(requester.id) === String(req.user.id);
  if (!isCurrentUserRequester && !allowedRequesterNamesSet.has(normalizeText(requester.nombre))) {
    return next(new ApiError(400, 'El solicitante no esta habilitado para prestamos'));
  }

  const resource = await one(
    'SELECT id, codigo, area, estado, cantidad_total, cantidad_disponible FROM dbo.recursos WHERE id = @id;',
    { id: resourceDbId }
  );

  if (!resource || resource.estado !== 'ACTIVE') {
    return next(new ApiError(400, 'Recurso no valido'));
  }

  if (resource.cantidad_disponible < cantidadNumber) {
    return next(new ApiError(409, 'Stock insuficiente para el prestamo'));
  }

  const createdId = await withTransaction(async (tx) => {
    await query(
      `
      UPDATE dbo.recursos
      SET cantidad_disponible = cantidad_disponible - @cantidad,
          actualizado_en = SYSUTCDATETIME()
      WHERE id = @resourceId;
      `,
      { cantidad: cantidadNumber, resourceId: resourceDbId },
      tx
    );

    await query(
      `
      INSERT INTO dbo.prestamos
      (solicitante_id, recurso_id, cantidad, fecha_inicio, fecha_vencimiento, fecha_devolucion, comentarios, aprobado_por, estado, creado_en, actualizado_en)
      VALUES
      (@requesterId, @resourceId, @cantidad, @startDate, @dueDate, NULL, @comentarios, @approvedBy, 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME());
      `,
      {
        requesterId: finalRequesterId,
        resourceId: resourceDbId,
        cantidad: cantidadNumber,
        startDate: new Date(),
        dueDate: due,
        comentarios: comentarios || '',
        approvedBy: Number(req.user.id)
      },
      tx
    );

    const inserted = await one('SELECT TOP 1 id FROM dbo.prestamos ORDER BY id DESC;', {}, tx);
    return inserted.id;
  });

  const created = await one(
    `
    SELECT
      l.id, l.solicitante_id, l.recurso_id, l.cantidad, l.fecha_inicio, l.fecha_vencimiento, l.fecha_devolucion,
      l.comentarios, l.aprobado_por, l.estado, l.creado_en, l.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      app_u.nombre AS aprobado_por_nombre, app_u.email AS aprobado_por_email
    FROM dbo.prestamos l
    INNER JOIN dbo.usuarios req_u ON req_u.id = l.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    LEFT JOIN dbo.usuarios app_u ON app_u.id = l.aprobado_por
    WHERE l.id = @id;
    `,
    { id: createdId }
  );

  await audit({
    req,
    accion: 'CREAR_PRESTAMO',
    modulo: 'PRESTAMOS',
    entityId: String(createdId),
    detalles: { requester: requester.email, resource: resource.codigo, cantidad: cantidadNumber }
  });

  res.status(201).json({ success: true, data: mapLoanRow(created) });
};

const updateLoan = async (req, res, next) => {
  if (!isLibraryManager(req.user)) {
    return next(new ApiError(403, 'Solo el Encargado de Biblioteca puede editar prestamos'));
  }

  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de prestamo invalido'));
  }

  const loanId = Number(req.params.id);
  const loan = await one(
    `
    SELECT
      l.id, l.cantidad, l.fecha_inicio, l.fecha_vencimiento, l.comentarios, l.estado, l.recurso_id,
      res.area AS resource_area
    FROM dbo.prestamos l
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  if (!loan) {
    return next(new ApiError(404, 'Prestamo no encontrado'));
  }

  if (normalizeText(loan.resource_area) !== normalizeText(req.user.area)) {
    return next(new ApiError(403, 'No puedes editar prestamos fuera de tu area'));
  }

  if (!['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.estado)) {
    return next(new ApiError(409, 'Solo prestamos activos, vencidos o pendientes pueden editarse'));
  }

  const hasQuantity = req.body.cantidad !== undefined || req.body.quantity !== undefined;
  const hasDueDate = req.body.dueDate !== undefined || req.body.fecha_vencimiento !== undefined;
  const hasComments = req.body.comments !== undefined || req.body.comentarios !== undefined;
  if (!hasQuantity && !hasDueDate && !hasComments) {
    return next(new ApiError(400, 'Debes enviar al menos uno de estos campos: cantidad, dueDate o comments'));
  }

  const resource = await one(
    'SELECT id, cantidad_total, cantidad_disponible FROM dbo.recursos WHERE id = @id;',
    { id: loan.recurso_id }
  );
  if (!resource) {
    return next(new ApiError(404, 'Recurso asociado no encontrado'));
  }

  let newQuantity = loan.cantidad;
  if (hasQuantity) {
    newQuantity = Number(req.body.cantidad ?? req.body.quantity);
    if (!Number.isFinite(newQuantity) || newQuantity <= 0) {
      return next(new ApiError(400, 'cantidad invalida'));
    }
  }

  let newDueDate = loan.fecha_vencimiento;
  if (hasDueDate) {
    const due = new Date(req.body.dueDate || req.body.fecha_vencimiento);
    if (Number.isNaN(due.getTime())) {
      return next(new ApiError(400, 'dueDate invalido'));
    }
    if (due <= new Date(loan.fecha_inicio)) {
      return next(new ApiError(400, 'dueDate debe ser posterior a startDate'));
    }
    newDueDate = due;
  }

  const newComments = hasComments ? String(req.body.comments ?? req.body.comentarios ?? '').trim() : loan.comentarios;

  await withTransaction(async (tx) => {
    if (hasQuantity) {
      const delta = newQuantity - loan.cantidad;
      if (delta > 0 && resource.cantidad_disponible < delta) {
        throw new ApiError(409, 'Stock insuficiente para aumentar la cantidad del prestamo');
      }

      await query(
        `
        UPDATE dbo.recursos
        SET cantidad_disponible =
          CASE
            WHEN (cantidad_disponible - @delta) > cantidad_total THEN cantidad_total
            WHEN (cantidad_disponible - @delta) < 0 THEN 0
            ELSE (cantidad_disponible - @delta)
          END,
          actualizado_en = SYSUTCDATETIME()
        WHERE id = @resourceId;
        `,
        { delta, resourceId: resource.id },
        tx
      );
    }

    await query(
      `
      UPDATE dbo.prestamos
      SET cantidad = @cantidad,
          fecha_vencimiento = @dueDate,
          comentarios = @comentarios,
          actualizado_en = SYSUTCDATETIME()
      WHERE id = @id;
      `,
      {
        id: loanId,
        cantidad: newQuantity,
        dueDate: newDueDate,
        comentarios: newComments
      },
      tx
    );
  });

  const updated = await one(
    `
    SELECT
      l.id, l.solicitante_id, l.recurso_id, l.cantidad, l.fecha_inicio, l.fecha_vencimiento, l.fecha_devolucion,
      l.comentarios, l.aprobado_por, l.estado, l.creado_en, l.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      app_u.nombre AS aprobado_por_nombre, app_u.email AS aprobado_por_email
    FROM dbo.prestamos l
    INNER JOIN dbo.usuarios req_u ON req_u.id = l.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    LEFT JOIN dbo.usuarios app_u ON app_u.id = l.aprobado_por
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  await audit({
    req,
    accion: 'ACTUALIZAR_PRESTAMO',
    modulo: 'PRESTAMOS',
    entityId: String(loanId),
    detalles: { fields: Object.keys(req.body) }
  });

  res.json({ success: true, data: mapLoanRow(updated) });
};

const deactivateLoan = async (req, res, next) => {
  if (!isLibraryManager(req.user)) {
    return next(new ApiError(403, 'Solo el Encargado de Biblioteca puede desactivar prestamos'));
  }

  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de prestamo invalido'));
  }

  const loanId = Number(req.params.id);
  const loan = await one(
    `
    SELECT
      l.id, l.cantidad, l.estado, l.comentarios, l.recurso_id,
      res.area AS resource_area, res.cantidad_total, res.cantidad_disponible
    FROM dbo.prestamos l
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  if (!loan) {
    return next(new ApiError(404, 'Prestamo no encontrado'));
  }

  if (normalizeText(loan.resource_area) !== normalizeText(req.user.area)) {
    return next(new ApiError(403, 'No puedes desactivar prestamos fuera de tu area'));
  }

  if (!['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.estado)) {
    return next(new ApiError(409, 'Solo prestamos activos, vencidos o pendientes pueden desactivarse'));
  }

  await withTransaction(async (tx) => {
    await query(
      `
      UPDATE dbo.prestamos
      SET estado = 'CANCELLED',
          comentarios = @comentarios,
          actualizado_en = SYSUTCDATETIME()
      WHERE id = @id;
      `,
      {
        id: loanId,
        comentarios: req.body?.comments ? String(req.body.comments).trim() : loan.comentarios
      },
      tx
    );

    await query(
      `
      UPDATE dbo.recursos
      SET cantidad_disponible =
        CASE
          WHEN (cantidad_disponible + @qty) > cantidad_total THEN cantidad_total
          ELSE (cantidad_disponible + @qty)
        END,
        actualizado_en = SYSUTCDATETIME()
      WHERE id = @resourceId;
      `,
      { qty: loan.cantidad, resourceId: loan.recurso_id },
      tx
    );
  });

  const updated = await one(
    `
    SELECT
      l.id, l.solicitante_id, l.recurso_id, l.cantidad, l.fecha_inicio, l.fecha_vencimiento, l.fecha_devolucion,
      l.comentarios, l.aprobado_por, l.estado, l.creado_en, l.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      app_u.nombre AS aprobado_por_nombre, app_u.email AS aprobado_por_email
    FROM dbo.prestamos l
    INNER JOIN dbo.usuarios req_u ON req_u.id = l.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    LEFT JOIN dbo.usuarios app_u ON app_u.id = l.aprobado_por
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  await audit({
    req,
    accion: 'DESACTIVAR_PRESTAMO',
    modulo: 'PRESTAMOS',
    entityId: String(loanId),
    detalles: { estado: 'CANCELLED' }
  });

  res.json({ success: true, data: mapLoanRow(updated) });
};

const returnLoan = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de prestamo invalido'));
  }

  const loanId = Number(req.params.id);
  const loan = await one(
    `
    SELECT
      l.id, l.cantidad, l.estado, l.recurso_id,
      res.cantidad_total, res.cantidad_disponible
    FROM dbo.prestamos l
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  if (!loan) {
    return next(new ApiError(404, 'Prestamo no encontrado'));
  }

  if (!['ACTIVE', 'OVERDUE'].includes(loan.estado)) {
    return next(new ApiError(400, 'Solo prestamos activos o vencidos pueden cerrarse'));
  }

  const returnedDate = new Date();

  await withTransaction(async (tx) => {
    await query(
      `
      UPDATE dbo.prestamos
      SET estado = 'RETURNED',
          fecha_devolucion = @returnedDate,
          actualizado_en = SYSUTCDATETIME()
      WHERE id = @id;
      `,
      { id: loanId, returnedDate },
      tx
    );

    await query(
      `
      UPDATE dbo.recursos
      SET cantidad_disponible =
        CASE
          WHEN (cantidad_disponible + @qty) > cantidad_total THEN cantidad_total
          ELSE (cantidad_disponible + @qty)
        END,
        actualizado_en = SYSUTCDATETIME()
      WHERE id = @resourceId;
      `,
      { qty: loan.cantidad, resourceId: loan.recurso_id },
      tx
    );
  });

  const updated = await one(
    `
    SELECT
      l.id, l.solicitante_id, l.recurso_id, l.cantidad, l.fecha_inicio, l.fecha_vencimiento, l.fecha_devolucion,
      l.comentarios, l.aprobado_por, l.estado, l.creado_en, l.actualizado_en,
      req_u.nombre AS requester_nombre, req_u.email AS requester_email, req_u.area AS requester_area,
      res.nombre AS resource_nombre, res.codigo AS resource_codigo, res.area AS resource_area,
      app_u.nombre AS aprobado_por_nombre, app_u.email AS aprobado_por_email
    FROM dbo.prestamos l
    INNER JOIN dbo.usuarios req_u ON req_u.id = l.solicitante_id
    INNER JOIN dbo.recursos res ON res.id = l.recurso_id
    LEFT JOIN dbo.usuarios app_u ON app_u.id = l.aprobado_por
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  await audit({
    req,
    accion: 'DEVOLVER_PRESTAMO',
    modulo: 'PRESTAMOS',
    entityId: String(loanId),
    detalles: { returnedDate }
  });

  res.json({ success: true, data: mapLoanRow(updated) });
};

module.exports = {
  listLoans,
  createLoan,
  updateLoan,
  deactivateLoan,
  returnLoan
};






