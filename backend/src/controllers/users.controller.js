const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const { parsePagination, requireFields, isValidObjectId } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { one, query, scalar } = require('../services/sql.service');

const mapUserRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  name: row.name,
  email: row.email,
  area: row.area,
  phone: row.phone,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  role: row.role_id
    ? {
        _id: String(row.role_id),
        id: String(row.role_id),
        name: row.role_name
      }
    : null
});

const listUsers = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const where = [];
  const params = { skip, limit };

  if (req.query.role) {
    where.push('UPPER(r.name) = @roleName');
    params.roleName = req.query.role.toUpperCase();
  }

  if (req.query.status) {
    where.push('UPPER(u.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  if (req.query.q) {
    where.push('(u.name LIKE @search OR u.email LIKE @search OR u.area LIKE @search)');
    params.search = `%${req.query.q}%`;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      u.id, u.name, u.email, u.area, u.phone, u.status, u.created_at, u.updated_at,
      r.id AS role_id, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    ${whereClause}
    ORDER BY u.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: items.map(mapUserRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

const listOperationalUsers = async (req, res) => {
  const where = ['u.status = @status'];
  const params = { status: 'ACTIVE' };

  if (req.query.role) {
    where.push('UPPER(r.name) = @roleName');
    params.roleName = req.query.role.toUpperCase();
  }

  const users = await query(
    `
    SELECT
      u.id, u.name, u.email, u.area, u.phone, u.status, u.created_at, u.updated_at,
      r.id AS role_id, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE ${where.join(' AND ')}
    ORDER BY u.name ASC;
    `,
    params
  );

  res.json({ success: true, data: users.map(mapUserRow) });
};

const listRoles = async (req, res) => {
  const roles = await query(
    `
    SELECT id, name, description, status, created_at, updated_at
    FROM dbo.roles
    WHERE status = 'ACTIVE'
    ORDER BY name ASC;
    `
  );

  res.json({
    success: true,
    data: roles.map((row) => ({
      _id: String(row.id),
      id: String(row.id),
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  });
};

const createUser = async (req, res, next) => {
  const required = requireFields(req.body, ['name', 'email', 'password', 'roleId']);
  if (!required.valid) {
    return next(new ApiError(400, `Campos requeridos: ${required.missing.join(', ')}`));
  }

  if (!isValidObjectId(req.body.roleId)) {
    return next(new ApiError(400, 'roleId invalido'));
  }

  const role = await one('SELECT id, name, status FROM dbo.roles WHERE id = @id;', { id: Number(req.body.roleId) });
  if (!role || role.status !== 'ACTIVE') {
    return next(new ApiError(400, 'Rol invalido'));
  }

  const normalizedEmail = String(req.body.email).toLowerCase().trim();
  const existing = await one('SELECT id FROM dbo.users WHERE email = @email;', { email: normalizedEmail });
  if (existing) {
    return next(new ApiError(409, 'Ya existe un usuario con ese correo'));
  }

  const passwordHash = await bcrypt.hash(String(req.body.password), 10);

  await query(
    `
    INSERT INTO dbo.users
    (name, email, password, role_id, area, phone, status, created_at, updated_at)
    VALUES
    (@name, @email, @password, @roleId, @area, @phone, @status, SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      name: req.body.name,
      email: normalizedEmail,
      password: passwordHash,
      roleId: Number(req.body.roleId),
      area: req.body.area || 'General',
      phone: req.body.phone || '',
      status: req.body.status || 'ACTIVE'
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      u.id, u.name, u.email, u.area, u.phone, u.status, u.created_at, u.updated_at,
      r.id AS role_id, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.email = @email
    ORDER BY u.id DESC;
    `,
    { email: normalizedEmail }
  );

  await audit({
    req,
    action: 'CREAR_USUARIO',
    module: 'USUARIOS',
    entityId: String(created.id),
    details: { email: created.email, role: role.name }
  });

  res.status(201).json({ success: true, data: mapUserRow(created) });
};

const updateUser = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de usuario invalido'));
  }

  const userId = Number(req.params.id);
  const current = await one('SELECT id FROM dbo.users WHERE id = @id;', { id: userId });
  if (!current) {
    return next(new ApiError(404, 'Usuario no encontrado'));
  }

  let roleId = null;
  if (req.body.roleId !== undefined) {
    if (!isValidObjectId(req.body.roleId)) {
      return next(new ApiError(400, 'roleId invalido'));
    }

    const role = await one('SELECT id FROM dbo.roles WHERE id = @id;', { id: Number(req.body.roleId) });
    if (!role) {
      return next(new ApiError(400, 'Rol no encontrado'));
    }
    roleId = Number(req.body.roleId);
  }

  if (req.body.email) {
    const normalizedEmail = String(req.body.email).toLowerCase().trim();
    const duplicated = await one(
      'SELECT id FROM dbo.users WHERE email = @email AND id <> @id;',
      { email: normalizedEmail, id: userId }
    );
    if (duplicated) {
      return next(new ApiError(409, 'Ya existe un usuario con ese correo'));
    }
  }

  const updates = [];
  const params = { id: userId };

  const assign = (field, key, value) => {
    updates.push(`${field} = @${key}`);
    params[key] = value;
  };

  if (req.body.name !== undefined) assign('name', 'name', req.body.name);
  if (req.body.area !== undefined) assign('area', 'area', req.body.area);
  if (req.body.phone !== undefined) assign('phone', 'phone', req.body.phone);
  if (req.body.email !== undefined) assign('email', 'email', String(req.body.email).toLowerCase().trim());
  if (roleId !== null) assign('role_id', 'roleId', roleId);

  if (req.body.password !== undefined) {
    const hash = await bcrypt.hash(String(req.body.password), 10);
    assign('password', 'password', hash);
  }

  if (updates.length > 0) {
    updates.push('updated_at = SYSUTCDATETIME()');
    await query(`UPDATE dbo.users SET ${updates.join(', ')} WHERE id = @id;`, params);
  }

  const updated = await one(
    `
    SELECT
      u.id, u.name, u.email, u.area, u.phone, u.status, u.created_at, u.updated_at,
      r.id AS role_id, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.id = @id;
    `,
    { id: userId }
  );

  await audit({
    req,
    action: 'ACTUALIZAR_USUARIO',
    module: 'USUARIOS',
    entityId: String(userId),
    details: { fields: Object.keys(req.body) }
  });

  res.json({ success: true, data: mapUserRow(updated) });
};

const updateUserStatus = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de usuario invalido'));
  }

  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes((status || '').toUpperCase())) {
    return next(new ApiError(400, 'status debe ser ACTIVE o INACTIVE'));
  }

  const userId = Number(req.params.id);
  const current = await one('SELECT id FROM dbo.users WHERE id = @id;', { id: userId });
  if (!current) {
    return next(new ApiError(404, 'Usuario no encontrado'));
  }

  await query(
    `
    UPDATE dbo.users
    SET status = @status, updated_at = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    { id: userId, status: status.toUpperCase() }
  );

  const user = await one(
    `
    SELECT
      u.id, u.name, u.email, u.area, u.phone, u.status, u.created_at, u.updated_at,
      r.id AS role_id, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.id = @id;
    `,
    { id: userId }
  );

  await audit({
    req,
    action: 'ACTUALIZAR_ESTADO_USUARIO',
    module: 'USUARIOS',
    entityId: String(userId),
    details: { status: user.status }
  });

  res.json({ success: true, data: mapUserRow(user) });
};

const getMyProfile = async (req, res, next) => {
  const user = await one(
    `
    SELECT
      u.id, u.name, u.email, u.area, u.phone, u.status, u.created_at, u.updated_at,
      r.id AS role_id, r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.id = @id;
    `,
    { id: Number(req.user.id) }
  );

  if (!user) {
    return next(new ApiError(404, 'Usuario no encontrado'));
  }

  res.json({ success: true, data: mapUserRow(user) });
};

module.exports = {
  listUsers,
  listOperationalUsers,
  listRoles,
  createUser,
  updateUser,
  updateUserStatus,
  getMyProfile
};

