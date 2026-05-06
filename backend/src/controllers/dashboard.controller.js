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
    filters.loans.push('l.solicitante_id = @userId');
    filters.reservations.push('rv.solicitante_id = @userId');
    filters.internalRequests.push('ir.solicitante_id = @userId');
    filters.printRequests.push('pr.solicitante_id = @userId');
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
      FROM dbo.recursos r
      ${resourcesWhere ? `${resourcesWhere} AND r.estado = 'ACTIVE'` : "WHERE r.estado = 'ACTIVE'"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.prestamos l
      INNER JOIN dbo.recursos res ON res.id = l.recurso_id
      ${
        loansWhere
          ? `${loansWhere} AND l.estado IN ('ACTIVE', 'OVERDUE')`
          : "WHERE l.estado IN ('ACTIVE', 'OVERDUE')"
      };
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.reservas rv
      INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
      ${reservationsWhere ? `${reservationsWhere} AND rv.estado = 'PENDING'` : "WHERE rv.estado = 'PENDING'"};
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.solicitudes_internas ir
      ${
        internalWhere
          ? `${internalWhere} AND ir.estado IN ('PENDING', 'IN_PROGRESS')`
          : "WHERE ir.estado IN ('PENDING', 'IN_PROGRESS')"
      };
      `,
      params
    ),
    scalar(
      `
      SELECT COUNT(1) AS total
      FROM dbo.solicitudes_impresion pr
      ${printsWhere ? `${printsWhere} AND pr.estado = 'PENDING'` : "WHERE pr.estado = 'PENDING'"};
      `,
      params
    ),
    query(
      `
      SELECT TOP 8
        r.id, r.nombre, r.codigo, r.cantidad_disponible, r.stock_minimo
      FROM dbo.recursos r
      ${
        resourcesWhere
          ? `${resourcesWhere} AND r.estado = 'ACTIVE' AND r.cantidad_disponible <= r.stock_minimo`
          : "WHERE r.estado = 'ACTIVE' AND r.cantidad_disponible <= r.stock_minimo"
      }
      ORDER BY r.cantidad_disponible ASC;
      `,
      params
    ),
    query(
      `
      SELECT TOP 8
        l.id, l.fecha_vencimiento, l.estado, l.cantidad,
        req_u.id AS solicitante_id, req_u.nombre AS requester_nombre,
        res.id AS recurso_id, res.nombre AS resource_nombre, res.codigo AS resource_codigo
      FROM dbo.prestamos l
      INNER JOIN dbo.usuarios req_u ON req_u.id = l.solicitante_id
      INNER JOIN dbo.recursos res ON res.id = l.recurso_id
      ${
        loansWhere
          ? `${loansWhere} AND l.estado IN ('ACTIVE', 'OVERDUE') AND l.fecha_vencimiento < @now`
          : "WHERE l.estado IN ('ACTIVE', 'OVERDUE') AND l.fecha_vencimiento < @now"
      }
      ORDER BY l.fecha_vencimiento ASC;
      `,
      params
    ),
    query(
      `
      SELECT l.estado, COUNT(1) AS total
      FROM dbo.prestamos l
      INNER JOIN dbo.recursos res ON res.id = l.recurso_id
      ${loansWhere}
      GROUP BY l.estado;
      `,
      params
    ),
    query(
      `
      SELECT rv.estado, COUNT(1) AS total
      FROM dbo.reservas rv
      INNER JOIN dbo.recursos res ON res.id = rv.recurso_id
      ${reservationsWhere}
      GROUP BY rv.estado;
      `,
      params
    ),
    query(
      `
      SELECT TOP 6
        c.nombre AS category,
        COUNT(1) AS total
      FROM dbo.recursos r
      INNER JOIN dbo.categorias c ON c.id = r.categoria_id
      ${resourcesWhere}
      GROUP BY c.nombre
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
          name: row.nombre,
          nombre: row.nombre,
          code: row.codigo,
          codigo: row.codigo,
          availableQuantity: row.cantidad_disponible,
          minStock: row.stock_minimo
        })),
        overdueLoans: overdueLoans.map((row) => ({
          _id: String(row.id),
          id: String(row.id),
          dueDate: row.fecha_vencimiento,
          status: row.estado,
          estado: row.estado,
          quantity: row.cantidad,
          cantidad: row.cantidad,
          requester: {
            _id: String(row.solicitante_id),
            id: String(row.solicitante_id),
            name: row.requester_nombre,
            nombre: row.requester_nombre
          },
          resource: {
            _id: String(row.recurso_id),
            id: String(row.recurso_id),
            name: row.resource_nombre,
            nombre: row.resource_nombre,
            code: row.resource_codigo,
            codigo: row.resource_codigo
          }
        }))
      },
      charts: {
        loanStatus: loanStatusChart.map((row) => ({ status: row.estado, estado: row.estado, total: Number(row.total) })),
        reservationStatus: reservationStatusChart.map((row) => ({ status: row.estado, estado: row.estado, total: Number(row.total) })),
        resourcesByCategory: resourcesByCategory.map((row) => ({ category: row.category, total: Number(row.total) }))
      }
    }
  });
};

module.exports = {
  getDashboard
};






