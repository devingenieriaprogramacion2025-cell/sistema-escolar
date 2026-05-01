const ApiError = require('../utils/ApiError');
const { parsePagination, isValidObjectId, requireFields } = require('../utils/validators');
const { audit } = require('../services/audit.service');
const { ROLES } = require('../constants/roles');
const { query, one, scalar } = require('../services/sql.service');

const mapResourceRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  code: row.code,
  name: row.name,
  description: row.description,
  area: row.area,
  location: row.location,
  unit: row.unit_name,
  totalQuantity: row.total_quantity,
  availableQuantity: row.available_quantity,
  minStock: row.min_stock,
  price: Number(row.price),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  category: row.category_id
    ? {
        _id: String(row.category_id),
        id: String(row.category_id),
        name: row.category_name
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

  if (req.query.status) {
    filters.push('UPPER(r.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  if (req.query.categoryId && isValidObjectId(req.query.categoryId)) {
    filters.push('r.category_id = @categoryId');
    params.categoryId = Number(req.query.categoryId);
  }

  if (req.query.area) {
    filters.push('r.area = @area');
    params.area = req.query.area;
  }

  if (req.query.q) {
    filters.push('(r.code LIKE @search OR r.name LIKE @search OR r.location LIKE @search)');
    params.search = `%${req.query.q}%`;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      r.id, r.code, r.name, r.description, r.area, r.location, r.unit_name, r.total_quantity,
      r.available_quantity, r.min_stock, r.price, r.status, r.created_at, r.updated_at,
      c.id AS category_id, c.name AS category_name
    FROM dbo.resources r
    INNER JOIN dbo.categories c ON c.id = r.category_id
    ${whereClause}
    ORDER BY r.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.resources r
    INNER JOIN dbo.categories c ON c.id = r.category_id
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
  const required = requireFields(req.body, ['code', 'name', 'categoryId', 'totalQuantity', 'area']);
  if (!required.valid) {
    return next(new ApiError(400, `Campos requeridos: ${required.missing.join(', ')}`));
  }

  if (!isValidObjectId(req.body.categoryId)) {
    return next(new ApiError(400, 'categoryId invalido'));
  }

  const category = await one(
    'SELECT id, status FROM dbo.categories WHERE id = @id;',
    { id: Number(req.body.categoryId) }
  );

  if (!category || category.status !== 'ACTIVE') {
    return next(new ApiError(400, 'Categoria invalida'));
  }

  if (req.user.role === ROLES.ENCARGADO && req.user.area !== req.body.area) {
    return next(new ApiError(403, 'Solo puedes crear recursos de tu area'));
  }

  const exists = await one('SELECT id FROM dbo.resources WHERE code = @code;', { code: req.body.code });
  if (exists) {
    return next(new ApiError(409, 'Ya existe un recurso con ese codigo'));
  }

  const totalQuantity = Number(req.body.totalQuantity);
  const availableQuantity =
    req.body.availableQuantity !== undefined ? Number(req.body.availableQuantity) : totalQuantity;

  await query(
    `
    INSERT INTO dbo.resources
    (code, name, category_id, description, area, location, unit_name, total_quantity, available_quantity, min_stock, price, status, created_at, updated_at)
    VALUES
    (@code, @name, @categoryId, @description, @area, @location, @unit, @totalQuantity, @availableQuantity, @minStock, @price, @status, SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      code: req.body.code,
      name: req.body.name,
      categoryId: Number(req.body.categoryId),
      description: req.body.description || '',
      area: req.body.area,
      location: req.body.location || '',
      unit: req.body.unit || 'unidad',
      totalQuantity,
      availableQuantity,
      minStock: Number(req.body.minStock || 0),
      price: Number(req.body.price || 0),
      status: req.body.status || 'ACTIVE'
    }
  );

  const created = await one(
    `
    SELECT TOP 1
      r.id, r.code, r.name, r.description, r.area, r.location, r.unit_name, r.total_quantity,
      r.available_quantity, r.min_stock, r.price, r.status, r.created_at, r.updated_at,
      c.id AS category_id, c.name AS category_name
    FROM dbo.resources r
    INNER JOIN dbo.categories c ON c.id = r.category_id
    WHERE r.code = @code
    ORDER BY r.id DESC;
    `,
    { code: req.body.code }
  );

  await audit({
    req,
    action: 'CREAR_RECURSO',
    module: 'RECURSOS',
    entityId: String(created.id),
    details: { code: created.code, area: created.area }
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
    SELECT id, code, area
    FROM dbo.resources
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

  let categoryId = null;
  if (req.body.categoryId) {
    if (!isValidObjectId(req.body.categoryId)) {
      return next(new ApiError(400, 'categoryId invalido'));
    }
    const category = await one('SELECT id FROM dbo.categories WHERE id = @id;', { id: Number(req.body.categoryId) });
    if (!category) {
      return next(new ApiError(400, 'Categoria no encontrada'));
    }
    categoryId = Number(req.body.categoryId);
  }

  if (req.body.code !== undefined) {
    const duplicated = await one(
      'SELECT id FROM dbo.resources WHERE code = @code AND id <> @id;',
      { code: req.body.code, id: resourceId }
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

  if (req.body.code !== undefined) assign('code', 'code', req.body.code);
  if (req.body.name !== undefined) assign('name', 'name', req.body.name);
  if (categoryId !== null) assign('category_id', 'categoryId', categoryId);
  if (req.body.description !== undefined) assign('description', 'description', req.body.description);
  if (req.body.area !== undefined) assign('area', 'area', req.body.area);
  if (req.body.location !== undefined) assign('location', 'location', req.body.location);
  if (req.body.unit !== undefined) assign('unit_name', 'unit', req.body.unit);
  if (req.body.totalQuantity !== undefined) assign('total_quantity', 'totalQuantity', Number(req.body.totalQuantity));
  if (req.body.availableQuantity !== undefined) assign('available_quantity', 'availableQuantity', Number(req.body.availableQuantity));
  if (req.body.minStock !== undefined) assign('min_stock', 'minStock', Number(req.body.minStock));
  if (req.body.price !== undefined) assign('price', 'price', Number(req.body.price));
  if (req.body.status !== undefined) assign('status', 'status', req.body.status);

  if (req.user.role === ROLES.ENCARGADO && req.body.area !== undefined && req.body.area !== req.user.area) {
    return next(new ApiError(403, 'No puedes mover recursos a otra area'));
  }

  if (updates.length > 0) {
    updates.push('updated_at = SYSUTCDATETIME()');
    await query(`UPDATE dbo.resources SET ${updates.join(', ')} WHERE id = @id;`, params);
  }

  const updated = await one(
    `
    SELECT
      r.id, r.code, r.name, r.description, r.area, r.location, r.unit_name, r.total_quantity,
      r.available_quantity, r.min_stock, r.price, r.status, r.created_at, r.updated_at,
      c.id AS category_id, c.name AS category_name
    FROM dbo.resources r
    INNER JOIN dbo.categories c ON c.id = r.category_id
    WHERE r.id = @id;
    `,
    { id: resourceId }
  );

  await audit({
    req,
    action: 'ACTUALIZAR_RECURSO',
    module: 'RECURSOS',
    entityId: String(resourceId),
    details: { fields: Object.keys(req.body) }
  });

  res.json({ success: true, data: mapResourceRow(updated) });
};

const deleteResource = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de recurso invalido'));
  }

  const resourceId = Number(req.params.id);
  const resource = await one('SELECT id, area FROM dbo.resources WHERE id = @id;', { id: resourceId });
  if (!resource) {
    return next(new ApiError(404, 'Recurso no encontrado'));
  }

  if (req.user.role === ROLES.ENCARGADO && resource.area !== req.user.area) {
    return next(new ApiError(403, 'Solo puedes desactivar recursos de tu area'));
  }

  await query(
    `
    UPDATE dbo.resources
    SET status = 'INACTIVE', updated_at = SYSUTCDATETIME()
    WHERE id = @id;
    `,
    { id: resourceId }
  );

  await audit({
    req,
    action: 'DESACTIVAR_RECURSO',
    module: 'RECURSOS',
    entityId: String(resourceId),
    details: { mode: 'soft-delete' }
  });

  res.json({ success: true, message: 'Recurso desactivado' });
};

const listCategories = async (req, res) => {
  const filters = [];
  const params = {};
  if (req.query.status) {
    filters.push('UPPER(status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const categories = await query(
    `
    SELECT id, name, description, status, created_at, updated_at
    FROM dbo.categories
    ${whereClause}
    ORDER BY name ASC;
    `,
    params
  );

  res.json({
    success: true,
    data: categories.map((row) => ({
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

const createCategory = async (req, res, next) => {
  const required = requireFields(req.body, ['name']);
  if (!required.valid) {
    return next(new ApiError(400, 'Nombre de categoria requerido'));
  }

  const exists = await one('SELECT id FROM dbo.categories WHERE name = @name;', { name: req.body.name });
  if (exists) {
    return next(new ApiError(409, 'Ya existe una categoria con ese nombre'));
  }

  await query(
    `
    INSERT INTO dbo.categories (name, description, status, created_at, updated_at)
    VALUES (@name, @description, @status, SYSUTCDATETIME(), SYSUTCDATETIME());
    `,
    {
      name: req.body.name,
      description: req.body.description || '',
      status: req.body.status || 'ACTIVE'
    }
  );

  const category = await one(
    `
    SELECT TOP 1 id, name, description, status, created_at, updated_at
    FROM dbo.categories
    WHERE name = @name
    ORDER BY id DESC;
    `,
    { name: req.body.name }
  );

  await audit({
    req,
    action: 'CREAR_CATEGORIA',
    module: 'RECURSOS',
    entityId: String(category.id),
    details: { name: category.name }
  });

  res.status(201).json({
    success: true,
    data: {
      _id: String(category.id),
      id: String(category.id),
      name: category.name,
      description: category.description,
      status: category.status,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }
  });
};

const updateCategory = async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new ApiError(400, 'Id de categoria invalido'));
  }

  const categoryId = Number(req.params.id);
  const current = await one('SELECT id FROM dbo.categories WHERE id = @id;', { id: categoryId });
  if (!current) {
    return next(new ApiError(404, 'Categoria no encontrada'));
  }

  if (req.body.name !== undefined) {
    const duplicated = await one(
      'SELECT id FROM dbo.categories WHERE name = @name AND id <> @id;',
      { name: req.body.name, id: categoryId }
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

  if (req.body.name !== undefined) assign('name', 'name', req.body.name);
  if (req.body.description !== undefined) assign('description', 'description', req.body.description);
  if (req.body.status !== undefined) assign('status', 'status', req.body.status);

  if (updates.length > 0) {
    updates.push('updated_at = SYSUTCDATETIME()');
    await query(`UPDATE dbo.categories SET ${updates.join(', ')} WHERE id = @id;`, params);
  }

  const category = await one(
    `
    SELECT id, name, description, status, created_at, updated_at
    FROM dbo.categories
    WHERE id = @id;
    `,
    { id: categoryId }
  );

  await audit({
    req,
    action: 'ACTUALIZAR_CATEGORIA',
    module: 'RECURSOS',
    entityId: String(categoryId),
    details: { fields: Object.keys(req.body) }
  });

  res.json({
    success: true,
    data: {
      _id: String(category.id),
      id: String(category.id),
      name: category.name,
      description: category.description,
      status: category.status,
      createdAt: category.created_at,
      updatedAt: category.updated_at
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

