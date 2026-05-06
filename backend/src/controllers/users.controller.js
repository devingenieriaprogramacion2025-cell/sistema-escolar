const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const { parsePagination, requireFields, isValidObjectId } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { one, query, scalar } = require('../services/sql.service');

const mapUserRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  name: row.nombre,
  nombre: row.nombre,
  email: row.email,
  area: row.area,
  phone: row.telefono,
  telefono: row.telefono,
  status: row.estado,
  estado: row.estado,
  createdAt: row.creado_en,
  updatedAt: row.actualizado_en,
  role: row.rol_id
    ? {
        _id: String(row.rol_id),
        id: String(row.rol_id),
        name: row.rol_nombre,
        nombre: row.rol_nombre
      }
    : null
});

const listUsers = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const where = [];
  const params = { skip, limit };

  if (req.query.role) {
    where.push('UPPER(r.nombre) = @rolName');
    params.rolName = req.query.role.toUpperCase();
  }

  if (req.query.estado) {
    where.push('UPPER(u.estado) = @estado');
    params.estado = req.query.estado.toUpperCase();
  }

  if (req.query.q) {
    where.push('(u.nombre LIKE @search OR u.email LIKE @search OR u.area LIKE @search)');
    params.search = `%${req.query.q}%`;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      u.id, u.nombre, u.email, u.area, u.telefono, u.estado, u.creado_en, u.actualizado_en,
      r.id AS rol_id, r.nombre AS rol_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    ${whereClause}
    ORDER BY u.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
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
  const where = ['u.estado = @estado'];
  const params = { estado: 'ACTIVE' };

  if (req.query.role) {
    where.push('UPPER(r.nombre) = @rolName');
    params.rolName = req.query.role.toUpperCase();
  }

  const users = await query(
    `
    SELECT
      u.id, u.nombre, u.email, u.area, u.telefono, u.estado, u.creado_en, u.actualizado_en,
      r.id AS rol_id, r.nombre AS rol_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    WHERE ${where.join(' AND ')}
    ORDER BY u.nombre ASC;
    `,
    params
  );

  res.json({ success: true, data: users.map(mapUserRow) });
};

const listRoles = async (req, res) => {
  const roles = await query(
    `
    SELECT id, nombre, descripcion, estado, creado_en, actualizado_en
    FROM dbo.roles
    WHERE estado = 'ACTIVE'
    ORDER BY nombre ASC;
    `
  );

  res.json({
    success: true,
    data: roles.map((row) => ({
      _id: String(row.id),
      id: String(row.id),
      name: row.nombre,
      nombre: row.nombre,
      description: row.descripcion,
      descripcion: row.descripcion,
      status: row.estado,
      estado: row.estado,
      createdAt: row.creado_en,
      updatedAt: row.actualizado_en
    }))
  });
};

const createUser = async (req, res, next) => {
  const payload = {
    nombre: req.body.nombre ?? req.body.name,
    email: req.body.email,
    contrasena: req.body.contrasena ?? req.body.password,
    roleId: req.body.roleId,
    area: req.body.area,
    telefono: req.body.telefono ?? req.body.phone,
    estado: req.body.estado ?? req.body.status
  };

  const required = requireFields(payload, ['nombre', 'email', 'contrasena', 'roleId']);
  if (!required.valid) {
    return next(new ApiError(400, `Campos requeridos: ${required.missing.join(', ')}`));
  }

  if (!isValidObjectId(payload.roleId)) {
    return next(new ApiError(400, 'roleId invalido'));
  }

  const rol = await one('SELECT id, nombre, estado FROM dbo.roles WHERE id = @id;', { id: Number(payload.roleId) });
  if (!rol || rol.estado !== 'ACTIVE') {
    return next(new ApiError(400, 'Rol invalido'));
  }

  const normalizedEmail = String(payload.email).toLowerCase().trim();
  const existing = await one('SELECT id FROM dbo.usuarios WHERE email = @email;', { email: normalizedEmail });
  if (existing) {
    return next(new ApiError(409, 'Ya existe un usuario con ese correo'));
  }

  const contrasenaHash = await bcrypt.hash(String(payload.contrasena), 10);

  await query(
    `
    INSERT INTO dbo.usuarios
    (nombre, email, contrasena, rol_id, area, telefono, estado, creado_en, actualizado_en)
    VALUES
    (@nombre, @email, @contrasena, @roleId, @area, @telefono, @estado, SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      nombre: payload.nombre,
      email: normalizedEmail,
      contrasena: contrasenaHash,
      roleId: Number(payload.roleId),
      area: payload.area || 'General',
      telefono: payload.telefono || '',
      estado: payload.estado || 'ACTIVE'
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      u.id, u.nombre, u.email, u.area, u.telefono, u.estado, u.creado_en, u.actualizado_en,
      r.id AS rol_id, r.nombre AS rol_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    WHERE u.email = @email
    ORDER BY u.id DESC;
    `,
    { email: normalizedEmail }
  );

  await audit({
    req,
    accion: 'CREAR_USUARIO',
    modulo: 'USUARIOS',
    entityId: String(created.id),
    detalles: { email: created.email, role: rol.nombre }
  });

  res.status(201).json({ success: true, data: mapUserRow(created) });
};

const updateUser = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de usuario invalido'));
  }

  const userId = Number(req.params.id);
  const current = await one('SELECT id FROM dbo.usuarios WHERE id = @id;', { id: userId });
  if (!current) {
    return next(new ApiError(404, 'Usuario no encontrado'));
  }

  const payload = {
    nombre: req.body.nombre ?? req.body.name,
    area: req.body.area,
    telefono: req.body.telefono ?? req.body.phone,
    email: req.body.email,
    contrasena: req.body.contrasena ?? req.body.password,
    roleId: req.body.roleId
  };

  let roleId = null;
  if (payload.roleId !== undefined) {
    if (!isValidObjectId(payload.roleId)) {
      return next(new ApiError(400, 'roleId invalido'));
    }

    const rol = await one('SELECT id FROM dbo.roles WHERE id = @id;', { id: Number(payload.roleId) });
    if (!rol) {
      return next(new ApiError(400, 'Rol no encontrado'));
    }
    roleId = Number(payload.roleId);
  }

  if (payload.email) {
    const normalizedEmail = String(payload.email).toLowerCase().trim();
    const duplicated = await one(
      'SELECT id FROM dbo.usuarios WHERE email = @email AND id <> @id;',
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

  if (payload.nombre !== undefined) assign('nombre', 'nombre', payload.nombre);
  if (payload.area !== undefined) assign('area', 'area', payload.area);
  if (payload.telefono !== undefined) assign('telefono', 'telefono', payload.telefono);
  if (payload.email !== undefined) assign('email', 'email', String(payload.email).toLowerCase().trim());
  if (roleId !== null) assign('rol_id', 'roleId', roleId);

  if (payload.contrasena !== undefined) {
    const hash = await bcrypt.hash(String(payload.contrasena), 10);
    assign('contrasena', 'contrasena', hash);
  }

  if (updates.length > 0) {
    updates.push('actualizado_en = SYSUTCDATETIME()');
    await query(`UPDATE dbo.usuarios SET ${updates.join(', ')} WHERE id = @id;`, params);
  }

  const updated = await one(
    `
    SELECT
      u.id, u.nombre, u.email, u.area, u.telefono, u.estado, u.creado_en, u.actualizado_en,
      r.id AS rol_id, r.nombre AS rol_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    WHERE u.id = @id;
    `,
    { id: userId }
  );

  await audit({
    req,
    accion: 'ACTUALIZAR_USUARIO',
    modulo: 'USUARIOS',
    entityId: String(userId),
    detalles: { fields: Object.keys(req.body) }
  });

  res.json({ success: true, data: mapUserRow(updated) });
};

const updateUserStatus = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de usuario invalido'));
  }

  const estado = req.body.estado ?? req.body.status;
  if (!['ACTIVE', 'INACTIVE'].includes((estado || '').toUpperCase())) {
    return next(new ApiError(400, 'estado debe ser ACTIVE o INACTIVE'));
  }

  const userId = Number(req.params.id);
  const current = await one('SELECT id FROM dbo.usuarios WHERE id = @id;', { id: userId });
  if (!current) {
    return next(new ApiError(404, 'Usuario no encontrado'));
  }

  await query(
    `
    UPDATE dbo.usuarios
    SET estado = @estado, actualizado_en = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    { id: userId, estado: estado.toUpperCase() }
  );

  const user = await one(
    `
    SELECT
      u.id, u.nombre, u.email, u.area, u.telefono, u.estado, u.creado_en, u.actualizado_en,
      r.id AS rol_id, r.nombre AS rol_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
    WHERE u.id = @id;
    `,
    { id: userId }
  );

  await audit({
    req,
    accion: 'ACTUALIZAR_ESTADO_USUARIO',
    modulo: 'USUARIOS',
    entityId: String(userId),
    detalles: { estado: user.estado }
  });

  res.json({ success: true, data: mapUserRow(user) });
};

const getMyProfile = async (req, res, next) => {
  const user = await one(
    `
    SELECT
      u.id, u.nombre, u.email, u.area, u.telefono, u.estado, u.creado_en, u.actualizado_en,
      r.id AS rol_id, r.nombre AS rol_nombre
    FROM dbo.usuarios u
    INNER JOIN dbo.roles r ON r.id = u.rol_id
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






