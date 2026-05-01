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

const allowedRequesterNamesSet = new Set(LOAN_REQUESTER_NAMES.map((name) => normalizeText(name)));

const isLibraryManager = (user) => user?.role === ROLES.ENCARGADO && normalizeText(user.area) === 'BIBLIOTECA';

const mapLoanRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  quantity: row.quantity,
  startDate: row.start_date,
  dueDate: row.due_date,
  returnedDate: row.returned_date,
  comments: row.comments,
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
  approvedBy: row.approved_by
    ? {
        _id: String(row.approved_by),
        id: String(row.approved_by),
        name: row.approved_by_name,
        email: row.approved_by_email
      }
    : null
});

const getLoanFiltersByRole = async (req) => {
  const filters = [];
  const params = {};

  if (req.user.role === ROLES.ENCARGADO) {
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

  if (req.query.status) {
    filters.push('UPPER(l.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  if (req.query.requesterId && isValidObjectId(req.query.requesterId)) {
    filters.push('l.requester_id = @requesterId');
    params.requesterId = Number(req.query.requesterId);
  }

  if (req.query.resourceId && isValidObjectId(req.query.resourceId)) {
    filters.push('l.resource_id = @resourceId');
    params.resourceId = Number(req.query.resourceId);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await query(
    `
    SELECT
      l.id, l.requester_id, l.resource_id, l.quantity, l.start_date, l.due_date, l.returned_date,
      l.comments, l.approved_by, l.status, l.created_at, l.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      app_u.name AS approved_by_name, app_u.email AS approved_by_email
    FROM dbo.loans l
    INNER JOIN dbo.users req_u ON req_u.id = l.requester_id
    INNER JOIN dbo.resources res ON res.id = l.resource_id
    LEFT JOIN dbo.users app_u ON app_u.id = l.approved_by
    ${whereClause}
    ORDER BY l.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.loans l
    INNER JOIN dbo.resources res ON res.id = l.resource_id
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

  const { requesterId, resourceId, quantity, dueDate, comments } = req.body;
  if (!resourceId || !quantity || !dueDate) {
    return next(new ApiError(400, 'resourceId, quantity y dueDate son requeridos'));
  }

  if (!isValidObjectId(resourceId)) {
    return next(new ApiError(400, 'resourceId invalido'));
  }

  if (requesterId && !isValidObjectId(requesterId)) {
    return next(new ApiError(400, 'requesterId invalido'));
  }

  const finalRequesterId = Number(requesterId || req.user.id);
  const resourceDbId = Number(resourceId);
  const quantityNumber = Number(quantity);
  if (quantityNumber <= 0) {
    return next(new ApiError(400, 'La cantidad debe ser mayor a 0'));
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return next(new ApiError(400, 'dueDate invalido'));
  }

  const requester = await one(
    `
    SELECT u.id, u.name, u.email, u.status, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.id = @id;
    `,
    { id: finalRequesterId }
  );

  if (!requester || requester.status !== 'ACTIVE') {
    return next(new ApiError(400, 'Solicitante no valido'));
  }

  const isCurrentUserRequester = String(requester.id) === String(req.user.id);
  if (!isCurrentUserRequester && !allowedRequesterNamesSet.has(normalizeText(requester.name))) {
    return next(new ApiError(400, 'El solicitante no esta habilitado para prestamos'));
  }

  const resource = await one(
    'SELECT id, code, area, status, total_quantity, available_quantity FROM dbo.resources WHERE id = @id;',
    { id: resourceDbId }
  );

  if (!resource || resource.status !== 'ACTIVE') {
    return next(new ApiError(400, 'Recurso no valido'));
  }

  if (resource.available_quantity < quantityNumber) {
    return next(new ApiError(409, 'Stock insuficiente para el prestamo'));
  }

  const createdId = await withTransaction(async (tx) => {
    await query(
      `
      UPDATE dbo.resources
      SET available_quantity = available_quantity - @quantity,
          updated_at = SYSUTCDATETIME()
      WHERE id = @resourceId;
      `,
      { quantity: quantityNumber, resourceId: resourceDbId },
      tx
    );

    await query(
      `
      INSERT INTO dbo.loans
      (requester_id, resource_id, quantity, start_date, due_date, returned_date, comments, approved_by, status, created_at, updated_at)
      VALUES
      (@requesterId, @resourceId, @quantity, @startDate, @dueDate, NULL, @comments, @approvedBy, 'ACTIVE', SYSUTCDATETIME(), SYSUTCDATETIME());
      `,
      {
        requesterId: finalRequesterId,
        resourceId: resourceDbId,
        quantity: quantityNumber,
        startDate: new Date(),
        dueDate: due,
        comments: comments || '',
        approvedBy: Number(req.user.id)
      },
      tx
    );

    const inserted = await one('SELECT TOP 1 id FROM dbo.loans ORDER BY id DESC;', {}, tx);
    return inserted.id;
  });

  const created = await one(
    `
    SELECT
      l.id, l.requester_id, l.resource_id, l.quantity, l.start_date, l.due_date, l.returned_date,
      l.comments, l.approved_by, l.status, l.created_at, l.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      app_u.name AS approved_by_name, app_u.email AS approved_by_email
    FROM dbo.loans l
    INNER JOIN dbo.users req_u ON req_u.id = l.requester_id
    INNER JOIN dbo.resources res ON res.id = l.resource_id
    LEFT JOIN dbo.users app_u ON app_u.id = l.approved_by
    WHERE l.id = @id;
    `,
    { id: createdId }
  );

  await audit({
    req,
    action: 'CREAR_PRESTAMO',
    module: 'PRESTAMOS',
    entityId: String(createdId),
    details: { requester: requester.email, resource: resource.code, quantity: quantityNumber }
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
      l.id, l.quantity, l.start_date, l.due_date, l.comments, l.status, l.resource_id,
      res.area AS resource_area
    FROM dbo.loans l
    INNER JOIN dbo.resources res ON res.id = l.resource_id
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

  if (!['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.status)) {
    return next(new ApiError(409, 'Solo prestamos activos, vencidos o pendientes pueden editarse'));
  }

  const hasQuantity = req.body.quantity !== undefined;
  const hasDueDate = req.body.dueDate !== undefined;
  const hasComments = req.body.comments !== undefined;
  if (!hasQuantity && !hasDueDate && !hasComments) {
    return next(new ApiError(400, 'Debes enviar al menos uno de estos campos: quantity, dueDate o comments'));
  }

  const resource = await one(
    'SELECT id, total_quantity, available_quantity FROM dbo.resources WHERE id = @id;',
    { id: loan.resource_id }
  );
  if (!resource) {
    return next(new ApiError(404, 'Recurso asociado no encontrado'));
  }

  let newQuantity = loan.quantity;
  if (hasQuantity) {
    newQuantity = Number(req.body.quantity);
    if (!Number.isFinite(newQuantity) || newQuantity <= 0) {
      return next(new ApiError(400, 'quantity invalida'));
    }
  }

  let newDueDate = loan.due_date;
  if (hasDueDate) {
    const due = new Date(req.body.dueDate);
    if (Number.isNaN(due.getTime())) {
      return next(new ApiError(400, 'dueDate invalido'));
    }
    if (due <= new Date(loan.start_date)) {
      return next(new ApiError(400, 'dueDate debe ser posterior a startDate'));
    }
    newDueDate = due;
  }

  const newComments = hasComments ? String(req.body.comments || '').trim() : loan.comments;

  await withTransaction(async (tx) => {
    if (hasQuantity) {
      const delta = newQuantity - loan.quantity;
      if (delta > 0 && resource.available_quantity < delta) {
        throw new ApiError(409, 'Stock insuficiente para aumentar la cantidad del prestamo');
      }

      await query(
        `
        UPDATE dbo.resources
        SET available_quantity =
          CASE
            WHEN (available_quantity - @delta) > total_quantity THEN total_quantity
            WHEN (available_quantity - @delta) < 0 THEN 0
            ELSE (available_quantity - @delta)
          END,
          updated_at = SYSUTCDATETIME()
        WHERE id = @resourceId;
        `,
        { delta, resourceId: resource.id },
        tx
      );
    }

    await query(
      `
      UPDATE dbo.loans
      SET quantity = @quantity,
          due_date = @dueDate,
          comments = @comments,
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;
      `,
      {
        id: loanId,
        quantity: newQuantity,
        dueDate: newDueDate,
        comments: newComments
      },
      tx
    );
  });

  const updated = await one(
    `
    SELECT
      l.id, l.requester_id, l.resource_id, l.quantity, l.start_date, l.due_date, l.returned_date,
      l.comments, l.approved_by, l.status, l.created_at, l.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      app_u.name AS approved_by_name, app_u.email AS approved_by_email
    FROM dbo.loans l
    INNER JOIN dbo.users req_u ON req_u.id = l.requester_id
    INNER JOIN dbo.resources res ON res.id = l.resource_id
    LEFT JOIN dbo.users app_u ON app_u.id = l.approved_by
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  await audit({
    req,
    action: 'ACTUALIZAR_PRESTAMO',
    module: 'PRESTAMOS',
    entityId: String(loanId),
    details: { fields: Object.keys(req.body) }
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
      l.id, l.quantity, l.status, l.comments, l.resource_id,
      res.area AS resource_area, res.total_quantity, res.available_quantity
    FROM dbo.loans l
    INNER JOIN dbo.resources res ON res.id = l.resource_id
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

  if (!['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.status)) {
    return next(new ApiError(409, 'Solo prestamos activos, vencidos o pendientes pueden desactivarse'));
  }

  await withTransaction(async (tx) => {
    await query(
      `
      UPDATE dbo.loans
      SET status = 'CANCELLED',
          comments = @comments,
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;
      `,
      {
        id: loanId,
        comments: req.body?.comments ? String(req.body.comments).trim() : loan.comments
      },
      tx
    );

    await query(
      `
      UPDATE dbo.resources
      SET available_quantity =
        CASE
          WHEN (available_quantity + @qty) > total_quantity THEN total_quantity
          ELSE (available_quantity + @qty)
        END,
        updated_at = SYSUTCDATETIME()
      WHERE id = @resourceId;
      `,
      { qty: loan.quantity, resourceId: loan.resource_id },
      tx
    );
  });

  const updated = await one(
    `
    SELECT
      l.id, l.requester_id, l.resource_id, l.quantity, l.start_date, l.due_date, l.returned_date,
      l.comments, l.approved_by, l.status, l.created_at, l.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      app_u.name AS approved_by_name, app_u.email AS approved_by_email
    FROM dbo.loans l
    INNER JOIN dbo.users req_u ON req_u.id = l.requester_id
    INNER JOIN dbo.resources res ON res.id = l.resource_id
    LEFT JOIN dbo.users app_u ON app_u.id = l.approved_by
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  await audit({
    req,
    action: 'DESACTIVAR_PRESTAMO',
    module: 'PRESTAMOS',
    entityId: String(loanId),
    details: { status: 'CANCELLED' }
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
      l.id, l.quantity, l.status, l.resource_id,
      res.total_quantity, res.available_quantity
    FROM dbo.loans l
    INNER JOIN dbo.resources res ON res.id = l.resource_id
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  if (!loan) {
    return next(new ApiError(404, 'Prestamo no encontrado'));
  }

  if (!['ACTIVE', 'OVERDUE'].includes(loan.status)) {
    return next(new ApiError(400, 'Solo prestamos activos o vencidos pueden cerrarse'));
  }

  const returnedDate = new Date();

  await withTransaction(async (tx) => {
    await query(
      `
      UPDATE dbo.loans
      SET status = 'RETURNED',
          returned_date = @returnedDate,
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;
      `,
      { id: loanId, returnedDate },
      tx
    );

    await query(
      `
      UPDATE dbo.resources
      SET available_quantity =
        CASE
          WHEN (available_quantity + @qty) > total_quantity THEN total_quantity
          ELSE (available_quantity + @qty)
        END,
        updated_at = SYSUTCDATETIME()
      WHERE id = @resourceId;
      `,
      { qty: loan.quantity, resourceId: loan.resource_id },
      tx
    );
  });

  const updated = await one(
    `
    SELECT
      l.id, l.requester_id, l.resource_id, l.quantity, l.start_date, l.due_date, l.returned_date,
      l.comments, l.approved_by, l.status, l.created_at, l.updated_at,
      req_u.name AS requester_name, req_u.email AS requester_email, req_u.area AS requester_area,
      res.name AS resource_name, res.code AS resource_code, res.area AS resource_area,
      app_u.name AS approved_by_name, app_u.email AS approved_by_email
    FROM dbo.loans l
    INNER JOIN dbo.users req_u ON req_u.id = l.requester_id
    INNER JOIN dbo.resources res ON res.id = l.resource_id
    LEFT JOIN dbo.users app_u ON app_u.id = l.approved_by
    WHERE l.id = @id;
    `,
    { id: loanId }
  );

  await audit({
    req,
    action: 'DEVOLVER_PRESTAMO',
    module: 'PRESTAMOS',
    entityId: String(loanId),
    details: { returnedDate }
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

