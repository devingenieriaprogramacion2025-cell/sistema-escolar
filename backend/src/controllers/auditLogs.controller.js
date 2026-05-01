const { parsePagination } = require('../utils/validators');
const { query, scalar } = require('../services/sql.service');

const mapAuditRow = (row) => ({
  _id: String(row.id),
  id: String(row.id),
  userEmail: row.user_email,
  role: row.role,
  action: row.action,
  module: row.module,
  entityId: row.entity_id,
  details: (() => {
    try {
      return JSON.parse(row.details || '{}');
    } catch (_) {
      return {};
    }
  })(),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  user: row.user_id
    ? {
        _id: String(row.user_id),
        id: String(row.user_id),
        name: row.user_name,
        email: row.user_email_join
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
      filters.push('a.created_at >= @fromDate');
      params.fromDate = from;
    }
  }

  if (req.query.to) {
    const to = new Date(req.query.to);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      filters.push('a.created_at <= @toDate');
      params.toDate = to;
    }
  }

  if (req.query.module) {
    filters.push('UPPER(a.module) = @module');
    params.module = req.query.module.toUpperCase();
  }

  if (req.query.action) {
    filters.push('a.action LIKE @action');
    params.action = `%${req.query.action}%`;
  }

  if (req.query.userEmail) {
    filters.push('a.user_email LIKE @userEmail');
    params.userEmail = `%${req.query.userEmail}%`;
  }

  if (req.query.status) {
    filters.push('UPPER(a.status) = @status');
    params.status = req.query.status.toUpperCase();
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const items = await query(
    `
    SELECT
      a.id, a.user_id, a.user_email, a.role, a.action, a.module, a.entity_id, a.details, a.status, a.created_at, a.updated_at,
      u.name AS user_name, u.email AS user_email_join
    FROM dbo.audit_logs a
    LEFT JOIN dbo.users u ON u.id = a.user_id
    ${whereClause}
    ORDER BY a.created_at DESC
    OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    params
  );

  const total = await scalar(
    `
    SELECT COUNT(1) AS total
    FROM dbo.audit_logs a
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

