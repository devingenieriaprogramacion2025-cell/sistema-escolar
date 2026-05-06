const ApiError = require('../utils/ApiError');
const { parsePagination, isValidObjectId, requireFields } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { ROLES } = require('../constants/roles');
const { query, one, scalar } = require('../services/sql.service');

const mapResourceRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  code: row.codigo,
  codigo: row.codigo,
  name: row.nombre,
  nombre: row.nombre,
  description: row.descripcion,
  descripcion: row.descripcion,
  area: row.area,
  location: row.ubicacion,
  ubicacion: row.ubicacion,
  unit: row.nombre_unidad,
  totalQuantity: row.cantidad_total,
  availableQuantity: row.cantidad_disponible,
  minStock: row.stock_minimo,
  price: Number(row.precio),
  precio: Number(row.precio),
  status: row.estado,
  estado: row.estado,
  createdAt: row.creado_en,
  updatedAt: row.actualizado_en,
  category: row.categoria_id
    ? {
        _id: String(row.categoria_id),
        id: String(row.categoria_id),
        name: row.categoria_nombre,
        nombre: row.categoria_nombre
      }
    : null
});

const buildResourceFilterByRole = async (req) => {
  const filters = [];
  const params = {};

  if (req.user.role === ROLES.ENCARGADO) {
    filters.push('r.area = @roleArea');
    params.roleArea = req.user.area;
  }

  return { filters, params };
};

const listResources = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const roleScope = await buildResourceFilterByRole(req);
  const filters = [...roleScope.filters];
  const params = { ...roleScope.params, skip, limit };

  const estadoFiltro = req.query.estado || req.query.status;
  if (estadoFiltro) {
    filters.push('UPPER(r.estado) = @estado');
    params.estado = String(estadoFiltro).toUpperCase();
  }

  if (req.query.categoryId && isValidObjectId(req.query.categoryId)) {
    filters.push('r.categoria_id = @categoryId');
    params.categoryId = Number(req.query.categoryId);
  }

  if (req.query.area) {
    filters.push('r.area = @area');
    params.area = req.query.area;
  }

  if (req.query.q) {
    filters.push('(r.codigo LIKE @search OR r.nombre LIKE @search OR r.ubicacion LIKE @search)');
    params.search = `%${req.query.q}%`;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      r.id, r.codigo, r.nombre, r.descripcion, r.area, r.ubicacion, r.nombre_unidad, r.cantidad_total,
      r.cantidad_disponible, r.stock_minimo, r.precio, r.estado, r.creado_en, r.actualizado_en,
      c.id AS categoria_id, c.nombre AS categoria_nombre
    FROM dbo.recursos r
    INNER JOIN dbo.categorias c ON c.id = r.categoria_id
    ${whereClause}
    ORDER BY r.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.recursos r
    INNER JOIN dbo.categorias c ON c.id = r.categoria_id
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: items.map(mapResourceRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

const createResource = async (req, res, next) => {
  const payload = {
    codigo: req.body.codigo ?? req.body.code,
    nombre: req.body.nombre ?? req.body.name,
    categoryId: req.body.categoryId,
    totalQuantity: req.body.totalQuantity,
    availableQuantity: req.body.availableQuantity,
    minStock: req.body.minStock,
    precio: req.body.precio ?? req.body.price,
    descripcion: req.body.descripcion ?? req.body.description,
    ubicacion: req.body.ubicacion ?? req.body.location,
    area: req.body.area,
    unit: req.body.unit,
    estado: req.body.estado ?? req.body.status
  };

  const required = requireFields(payload, ['codigo', 'nombre', 'categoryId', 'totalQuantity', 'area']);
  if (!required.valid) {
    return next(new ApiError(400, `Campos requeridos: ${required.missing.join(', ')}`));
  }

  if (!isValidObjectId(payload.categoryId)) {
    return next(new ApiError(400, 'categoryId invalido'));
  }

  const category = await one(
    'SELECT id, estado FROM dbo.categorias WHERE id = @id;',
    { id: Number(payload.categoryId) }
  );

  if (!category || category.estado !== 'ACTIVE') {
    return next(new ApiError(400, 'Categoria invalida'));
  }

  if (req.user.role === ROLES.ENCARGADO && req.user.area !== payload.area) {
    return next(new ApiError(403, 'Solo puedes crear recursos de tu area'));
  }

  const exists = await one('SELECT id FROM dbo.recursos WHERE codigo = @codigo;', { codigo: payload.codigo });
  if (exists) {
    return next(new ApiError(409, 'Ya existe un recurso con ese codigo'));
  }

  const totalQuantity = Number(payload.totalQuantity);
  const availableQuantity =
    payload.availableQuantity !== undefined ? Number(payload.availableQuantity) : totalQuantity;

  await query(
    `
    INSERT INTO dbo.recursos
    (codigo, nombre, categoria_id, descripcion, area, ubicacion, nombre_unidad, cantidad_total, cantidad_disponible, stock_minimo, precio, estado, creado_en, actualizado_en)
    VALUES
    (@codigo, @nombre, @categoryId, @descripcion, @area, @ubicacion, @unit, @totalQuantity, @availableQuantity, @minStock, @precio, @estado, SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      codigo: payload.codigo,
      nombre: payload.nombre,
      categoryId: Number(payload.categoryId),
      descripcion: payload.descripcion || '',
      area: payload.area,
      ubicacion: payload.ubicacion || '',
      unit: payload.unit || 'unidad',
      totalQuantity,
      availableQuantity,
      minStock: Number(payload.minStock || 0),
      precio: Number(payload.precio || 0),
      estado: payload.estado || 'ACTIVE'
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      r.id, r.codigo, r.nombre, r.descripcion, r.area, r.ubicacion, r.nombre_unidad, r.cantidad_total,
      r.cantidad_disponible, r.stock_minimo, r.precio, r.estado, r.creado_en, r.actualizado_en,
      c.id AS categoria_id, c.nombre AS categoria_nombre
    FROM dbo.recursos r
    INNER JOIN dbo.categorias c ON c.id = r.categoria_id
    WHERE r.codigo = @codigo
    ORDER BY r.id DESC;
    `,
    { codigo: payload.codigo }
  );

  await audit({
    req,
    accion: 'CREAR_RECURSO',
    modulo: 'RECURSOS',
    entityId: String(created.id),
    detalles: { codigo: created.codigo, area: created.area }
  });

  res.status(201).json({ success: true, data: mapResourceRow(created) });
};

const updateResource = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de recurso invalido'));
  }

  const resourceId = Number(req.params.id);

  const resource = await one(
    `
    SELECT id, codigo, area
    FROM dbo.recursos
    WHERE id = @id;
    `,
    { id: resourceId }
  );

  if (!resource) {
    return next(new ApiError(404, 'Recurso no encontrado'));
  }

  if (req.user.role === ROLES.ENCARGADO && resource.area !== req.user.area) {
    return next(new ApiError(403, 'Solo puedes editar recursos de tu area'));
  }

  const payload = {
    codigo: req.body.codigo ?? req.body.code,
    nombre: req.body.nombre ?? req.body.name,
    categoryId: req.body.categoryId,
    descripcion: req.body.descripcion ?? req.body.description,
    area: req.body.area,
    ubicacion: req.body.ubicacion ?? req.body.location,
    unit: req.body.unit,
    totalQuantity: req.body.totalQuantity,
    availableQuantity: req.body.availableQuantity,
    minStock: req.body.minStock,
    precio: req.body.precio ?? req.body.price,
    estado: req.body.estado ?? req.body.status
  };

  let categoryId = null;
  if (payload.categoryId) {
    if (!isValidObjectId(payload.categoryId)) {
      return next(new ApiError(400, 'categoryId invalido'));
    }
    const category = await one('SELECT id FROM dbo.categorias WHERE id = @id;', { id: Number(payload.categoryId) });
    if (!category) {
      return next(new ApiError(400, 'Categoria no encontrada'));
    }
    categoryId = Number(payload.categoryId);
  }

  if (payload.codigo !== undefined) {
    const duplicated = await one(
      'SELECT id FROM dbo.recursos WHERE codigo = @codigo AND id <> @id;',
      { codigo: payload.codigo, id: resourceId }
    );
    if (duplicated) {
      return next(new ApiError(409, 'Ya existe un recurso con ese codigo'));
    }
  }

  const updates = [];
  const params = { id: resourceId };
  const assign = (field, key, value) => {
    updates.push(`${field} = @${key}`);
    params[key] = value;
  };

  if (payload.codigo !== undefined) assign('codigo', 'codigo', payload.codigo);
  if (payload.nombre !== undefined) assign('nombre', 'nombre', payload.nombre);
  if (categoryId !== null) assign('categoria_id', 'categoryId', categoryId);
  if (payload.descripcion !== undefined) assign('descripcion', 'descripcion', payload.descripcion);
  if (payload.area !== undefined) assign('area', 'area', payload.area);
  if (payload.ubicacion !== undefined) assign('ubicacion', 'ubicacion', payload.ubicacion);
  if (payload.unit !== undefined) assign('nombre_unidad', 'unit', payload.unit);
  if (payload.totalQuantity !== undefined) assign('cantidad_total', 'totalQuantity', Number(payload.totalQuantity));
  if (payload.availableQuantity !== undefined) assign('cantidad_disponible', 'availableQuantity', Number(payload.availableQuantity));
  if (payload.minStock !== undefined) assign('stock_minimo', 'minStock', Number(payload.minStock));
  if (payload.precio !== undefined) assign('precio', 'precio', Number(payload.precio));
  if (payload.estado !== undefined) assign('estado', 'estado', payload.estado);

  if (req.user.role === ROLES.ENCARGADO && payload.area !== undefined && payload.area !== req.user.area) {
    return next(new ApiError(403, 'No puedes mover recursos a otra area'));
  }

  if (updates.length > 0) {
    updates.push('actualizado_en = SYSUTCDATETIME()');
    await query(`UPDATE dbo.recursos SET ${updates.join(', ')} WHERE id = @id;`, params);
  }

  const updated = await one(
    `
    SELECT
      r.id, r.codigo, r.nombre, r.descripcion, r.area, r.ubicacion, r.nombre_unidad, r.cantidad_total,
      r.cantidad_disponible, r.stock_minimo, r.precio, r.estado, r.creado_en, r.actualizado_en,
      c.id AS categoria_id, c.nombre AS categoria_nombre
    FROM dbo.recursos r
    INNER JOIN dbo.categorias c ON c.id = r.categoria_id
    WHERE r.id = @id;
    `,
    { id: resourceId }
  );

  await audit({
    req,
    accion: 'ACTUALIZAR_RECURSO',
    modulo: 'RECURSOS',
    entityId: String(resourceId),
    detalles: { fields: Object.keys(req.body) }
  });

  res.json({ success: true, data: mapResourceRow(updated) });
};

const deleteResource = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de recurso invalido'));
  }

  const resourceId = Number(req.params.id);
  const resource = await one('SELECT id, area FROM dbo.recursos WHERE id = @id;', { id: resourceId });
  if (!resource) {
    return next(new ApiError(404, 'Recurso no encontrado'));
  }

  if (req.user.role === ROLES.ENCARGADO && resource.area !== req.user.area) {
    return next(new ApiError(403, 'Solo puedes desactivar recursos de tu area'));
  }

  await query(
    `
    UPDATE dbo.recursos
    SET estado = 'INACTIVE', actualizado_en = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    { id: resourceId }
  );

  await audit({
    req,
    accion: 'DESACTIVAR_RECURSO',
    modulo: 'RECURSOS',
    entityId: String(resourceId),
    detalles: { mode: 'soft-delete' }
  });

  res.json({ success: true, message: 'Recurso desactivado' });
};

const listCategories = async (req, res) => {
  const filters = [];
  const params = {};
  const estadoFiltro = req.query.estado || req.query.status;
  if (estadoFiltro) {
    filters.push('UPPER(estado) = @estado');
    params.estado = String(estadoFiltro).toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const categories = await query(
    `
    SELECT id, nombre, descripcion, estado, creado_en, actualizado_en
    FROM dbo.categorias
    ${whereClause}
    ORDER BY nombre ASC;
    `,
    params
  );

  res.json({
    success: true,
    data: categories.map((row) => ({
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

const createCategory = async (req, res, next) => {
  const payload = {
    nombre: req.body.nombre ?? req.body.name,
    descripcion: req.body.descripcion ?? req.body.description,
    estado: req.body.estado ?? req.body.status
  };

  const required = requireFields(payload, ['nombre']);
  if (!required.valid) {
    return next(new ApiError(400, 'Nombre de categoria requerido'));
  }

  const exists = await one('SELECT id FROM dbo.categorias WHERE nombre = @nombre;', { nombre: payload.nombre });
  if (exists) {
    return next(new ApiError(409, 'Ya existe una categoria con ese nombre'));
  }

  await query(
    `
    INSERT INTO dbo.categorias (nombre, descripcion, estado, creado_en, actualizado_en)
    VALUES (@nombre, @descripcion, @estado, SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      nombre: payload.nombre,
      descripcion: payload.descripcion || '',
      estado: payload.estado || 'ACTIVE'
    }
  );

  const category = await one(
    `
    SELECT TOP 1 id, nombre, descripcion, estado, creado_en, actualizado_en
    FROM dbo.categorias
    WHERE nombre = @nombre
    ORDER BY id DESC;
    `,
    { nombre: payload.nombre }
  );

  await audit({
    req,
    accion: 'CREAR_CATEGORIA',
    modulo: 'RECURSOS',
    entityId: String(category.id),
    detalles: { nombre: category.nombre }
  });

  res.status(201).json({
    success: true,
    data: {
      _id: String(category.id),
      id: String(category.id),
      name: category.nombre,
      nombre: category.nombre,
      description: category.descripcion,
      descripcion: category.descripcion,
      status: category.estado,
      estado: category.estado,
      createdAt: category.creado_en,
      updatedAt: category.actualizado_en
    }
  });
};

const updateCategory = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de categoria invalido'));
  }

  const categoryId = Number(req.params.id);
  const current = await one('SELECT id FROM dbo.categorias WHERE id = @id;', { id: categoryId });
  if (!current) {
    return next(new ApiError(404, 'Categoria no encontrada'));
  }

  const payload = {
    nombre: req.body.nombre ?? req.body.name,
    descripcion: req.body.descripcion ?? req.body.description,
    estado: req.body.estado ?? req.body.status
  };

  if (payload.nombre !== undefined) {
    const duplicated = await one(
      'SELECT id FROM dbo.categorias WHERE nombre = @nombre AND id <> @id;',
      { nombre: payload.nombre, id: categoryId }
    );
    if (duplicated) {
      return next(new ApiError(409, 'Ya existe una categoria con ese nombre'));
    }
  }

  const updates = [];
  const params = { id: categoryId };
  const assign = (field, key, value) => {
    updates.push(`${field} = @${key}`);
    params[key] = value;
  };

  if (payload.nombre !== undefined) assign('nombre', 'nombre', payload.nombre);
  if (payload.descripcion !== undefined) assign('descripcion', 'descripcion', payload.descripcion);
  if (payload.estado !== undefined) assign('estado', 'estado', payload.estado);

  if (updates.length > 0) {
    updates.push('actualizado_en = SYSUTCDATETIME()');
    await query(`UPDATE dbo.categorias SET ${updates.join(', ')} WHERE id = @id;`, params);
  }

  const category = await one(
    `
    SELECT id, nombre, descripcion, estado, creado_en, actualizado_en
    FROM dbo.categorias
    WHERE id = @id;
    `,
    { id: categoryId }
  );

  await audit({
    req,
    accion: 'ACTUALIZAR_CATEGORIA',
    modulo: 'RECURSOS',
    entityId: String(categoryId),
    detalles: { fields: Object.keys(req.body) }
  });

  res.json({
    success: true,
    data: {
      _id: String(category.id),
      id: String(category.id),
      name: category.nombre,
      nombre: category.nombre,
      description: category.descripcion,
      descripcion: category.descripcion,
      status: category.estado,
      estado: category.estado,
      createdAt: category.creado_en,
      updatedAt: category.actualizado_en
    }
  });
};

module.exports = {
  listResources,
  createResource,
  updateResource,
  deleteResource,
  listCategories,
  createCategory,
  updateCategory
};






