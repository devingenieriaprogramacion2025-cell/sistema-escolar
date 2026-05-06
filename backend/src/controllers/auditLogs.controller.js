const { parsePagination } = require('../utils/validators');
const { query, scalar } = require('../services/sql.service');

const mapAuditRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  userEmail: row.correo_usuario,
  role: row.rol,
  action: row.accion,
  accion: row.accion,
  module: row.modulo,
  modulo: row.modulo,
  entityId: row.entidad_id,
  details: (() => {
    try {
      return JSON.parse(row.detalles || '{}');
    } catch (_) {
      return {};
    }
  })(),
  detalles: (() => {
    try {
      return JSON.parse(row.detalles || '{}');
    } catch (_) {
      return {};
    }
  })(),
  status: row.estado,
  estado: row.estado,
  createdAt: row.creado_en,
  updatedAt: row.actualizado_en,
  user: row.usuario_id
    ? {
        _id: String(row.usuario_id),
        id: String(row.usuario_id),
        nombre: row.user_nombre,
        email: row.correo_usuario_join
      }
    : null
});

const listAuditLogs = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filters = [];
  const params = { skip, limit };

  if (req.query.from) {
    const from = new Date(req.query.from);
    if (!Number.isNaN(from.getTime())) {
      filters.push('a.creado_en >= @fromDate');
      params.fromDate = from;
    }
  }

  if (req.query.to) {
    const to = new Date(req.query.to);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      filters.push('a.creado_en <= @toDate');
      params.toDate = to;
    }
  }

  const moduleFilter = req.query.modulo || req.query.module;
  if (moduleFilter) {
    filters.push('UPPER(a.modulo) = @modulo');
    params.modulo = String(moduleFilter).toUpperCase();
  }

  const actionFilter = req.query.accion || req.query.action;
  if (actionFilter) {
    filters.push('a.accion LIKE @accion');
    params.accion = `%${actionFilter}%`;
  }

  if (req.query.userEmail) {
    filters.push('a.correo_usuario LIKE @userEmail');
    params.userEmail = `%${req.query.userEmail}%`;
  }

  const statusFilter = req.query.estado || req.query.status;
  if (statusFilter) {
    filters.push('UPPER(a.estado) = @estado');
    params.estado = String(statusFilter).toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      a.id, a.usuario_id, a.correo_usuario, a.rol, a.accion, a.modulo, a.entidad_id, a.detalles, a.estado, a.creado_en, a.actualizado_en,
      u.nombre AS user_nombre, u.email AS correo_usuario_join
    FROM dbo.bitacora_auditoria a
    LEFT JOIN dbo.usuarios u ON u.id = a.usuario_id
    ${whereClause}
    ORDER BY a.creado_en DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.bitacora_auditoria a
    ${whereClause};
    `,
    params
  );

  res.json({
    success: true,
    data: items.map(mapAuditRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(Number(total) / limit)
    }
  });
};

module.exports = {
  listAuditLogs
};






