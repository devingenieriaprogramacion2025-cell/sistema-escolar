const { ROLES } = require('../constants/roles');
const { query, scalar } = require('../services/sql.service');

const getDashboard = async (req, res) => {
  const filters = {
    resources: [],
    loans: [],
    reservations: [],
    internalRequests: [],
    printRequests: []
  };

  const params = { now: new Date() };

  if (req.user.role === ROLES.DOCENTE) {
    filters.loans.push('l.requester_id = @userId');
    filters.reservations.push('rv.requester_id = @userId');
    filters.internalRequests.push('ir.requester_id = @userId');
    filters.printRequests.push('pr.requester_id = @userId');
    params.userId = Number(req.user.id);
  }

  if (req.user.role === ROLES.ENCARGADO) {
    filters.resources.push('r.area = @area');
    filters.loans.push('res.area = @area');
    filters.reservations.push('res.area = @area');
    params.area = req.user.area;
  }

  const resourcesWhere = filters.resources.length ? `WHERE ${filters.resources.join(' AND ')}` : '';
  const loansWhere = filters.loans.length ? `WHERE ${filters.loans.join(' AND ')}` : '';
  const reservationsWhere = filters.reservations.length ? `WHERE ${filters.reservations.join(' AND ')}` : '';
  const internalWhere = filters.internalRequests.length ? `WHERE ${filters.internalRequests.join(' AND ')}` : '';
  const printsWhere = filters.printRequests.length ? `WHERE ${filters.printRequests.join(' AND ')}` : '';

  const [
    totalResources,
    activeLoans,
    pendingReservations,
    pendingInternalRequests,
    pendingPrintRequests,
    lowStock,
    overdueLoans,
    loanStatusChart,
    reservationStatusChart,
    resourcesByCategory
  ] = await Promise.all([
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.resources r
      ${resourcesWhere ? `${resourcesWhere} AND r.status = 'ACTIVE'` : "WHERE r.status = 'ACTIVE'"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.loans l
      INNER JOIN dbo.resources res ON res.id = l.resource_id
      ${
        loansWhere
          ? `${loansWhere} AND l.status IN ('ACTIVE', 'OVERDUE')`
          : "WHERE l.status IN ('ACTIVE', 'OVERDUE')"
      };
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.reservations rv
      INNER JOIN dbo.resources res ON res.id = rv.resource_id
      ${reservationsWhere ? `${reservationsWhere} AND rv.status = 'PENDING'` : "WHERE rv.status = 'PENDING'"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.internal_requests ir
      ${
        internalWhere
          ? `${internalWhere} AND ir.status IN ('PENDING', 'IN_PROGRESS')`
          : "WHERE ir.status IN ('PENDING', 'IN_PROGRESS')"
      };
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.print_requests pr
      ${printsWhere ? `${printsWhere} AND pr.status = 'PENDING'` : "WHERE pr.status = 'PENDING'"};
      `,
      params
    ),
    query(
      `
      SELECT TOP 8
        r.id, r.name, r.code, r.available_quantity, r.min_stock
      FROM dbo.resources r
      ${
        resourcesWhere
          ? `${resourcesWhere} AND r.status = 'ACTIVE' AND r.available_quantity <= r.min_stock`
          : "WHERE r.status = 'ACTIVE' AND r.available_quantity <= r.min_stock"
      }
      ORDER BY r.available_quantity ASC;
      `,
      params
    ),
    query(
      `
      SELECT TOP 8
        l.id, l.due_date, l.status, l.quantity,
        req_u.id AS requester_id, req_u.name AS requester_name,
        res.id AS resource_id, res.name AS resource_name, res.code AS resource_code
      FROM dbo.loans l
      INNER JOIN dbo.users req_u ON req_u.id = l.requester_id
      INNER JOIN dbo.resources res ON res.id = l.resource_id
      ${
        loansWhere
          ? `${loansWhere} AND l.status IN ('ACTIVE', 'OVERDUE') AND l.due_date < @now`
          : "WHERE l.status IN ('ACTIVE', 'OVERDUE') AND l.due_date < @now"
      }
      ORDER BY l.due_date ASC;
      `,
      params
    ),
    query(
      `
      SELECT l.status, COUNT(1) AS total
      FROM dbo.loans l
      INNER JOIN dbo.resources res ON res.id = l.resource_id
      ${loansWhere}
      GROUP BY l.status;
      `,
      params
    ),
    query(
      `
      SELECT rv.status, COUNT(1) AS total
      FROM dbo.reservations rv
      INNER JOIN dbo.resources res ON res.id = rv.resource_id
      ${reservationsWhere}
      GROUP BY rv.status;
      `,
      params
    ),
    query(
      `
      SELECT TOP 6
        c.name AS category,
        COUNT(1) AS total
      FROM dbo.resources r
      INNER JOIN dbo.categories c ON c.id = r.category_id
      ${resourcesWhere}
      GROUP BY c.name
      ORDER BY total DESC;
      `,
      params
    )
  ]);

  res.json({
    success: true,
    data: {
      totals: {
        resources: Number(totalResources || 0),
        activeLoans: Number(activeLoans || 0),
        pendingReservations: Number(pendingReservations || 0),
        pendingInternalRequests: Number(pendingInternalRequests || 0),
        pendingPrintRequests: Number(pendingPrintRequests || 0)
      },
      alerts: {
        lowStock: lowStock.map((row) => ({
          _id: String(row.id),
          id: String(row.id),
          name: row.name,
          code: row.code,
          availableQuantity: row.available_quantity,
          minStock: row.min_stock
        })),
        overdueLoans: overdueLoans.map((row) => ({
          _id: String(row.id),
          id: String(row.id),
          dueDate: row.due_date,
          status: row.status,
          quantity: row.quantity,
          requester: {
            _id: String(row.requester_id),
            id: String(row.requester_id),
            name: row.requester_name
          },
          resource: {
            _id: String(row.resource_id),
            id: String(row.resource_id),
            name: row.resource_name,
            code: row.resource_code
          }
        }))
      },
      charts: {
        loanStatus: loanStatusChart.map((row) => ({ status: row.status, total: Number(row.total) })),
        reservationStatus: reservationStatusChart.map((row) => ({ status: row.status, total: Number(row.total) })),
        resourcesByCategory: resourcesByCategory.map((row) => ({ category: row.category, total: Number(row.total) }))
      }
    }
  });
};

module.exports = {
  getDashboard
};

