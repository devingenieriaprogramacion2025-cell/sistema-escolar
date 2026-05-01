(function dashboardPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const renderChart = (containerId, rows, labelKey) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!rows || rows.length === 0) {
      container.innerHTML = '<p class="auth-note">Sin datos para mostrar.</p>';
      return;
    }

    const maxValue = Math.max(...rows.map((item) => Number(item.total || item.count || 0)), 1);

    container.innerHTML = `
      <div class="chart-stack">
        ${rows
          .map((item) => {
            const value = Number(item.total || item.count || 0);
            const label = item[labelKey] || item.status || 'Item';
            const width = Math.max((value / maxValue) * 100, 3);
            return `
              <div class="chart-row">
                <span>${label}</span>
                <div class="chart-bar"><div class="chart-fill" style="width:${width}%"></div></div>
                <strong>${value}</strong>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  };

  const loadDashboard = async () => {
    const response = await app.api.get('/dashboard');
    const data = response.data;

    document.getElementById('kpiResources').textContent = app.ui.formatNumber(data.totals.resources);
    document.getElementById('kpiLoans').textContent = app.ui.formatNumber(data.totals.activeLoans);
    document.getElementById('kpiReservations').textContent = app.ui.formatNumber(data.totals.pendingReservations);
    document.getElementById('kpiRequests').textContent = app.ui.formatNumber(data.totals.pendingInternalRequests);
    document.getElementById('kpiPrints').textContent = app.ui.formatNumber(data.totals.pendingPrintRequests);

    const lowStock = document.getElementById('lowStockList');
    if (data.alerts.lowStock.length === 0) {
      lowStock.innerHTML = '<li>Sin alertas de stock critico.</li>';
    } else {
      lowStock.innerHTML = data.alerts.lowStock
        .map(
          (item) =>
            `<li>${item.name} (${item.code}) - Disponible: ${item.availableQuantity} / Minimo: ${item.minStock}</li>`
        )
        .join('');
    }

    const overdue = document.getElementById('overdueList');
    if (data.alerts.overdueLoans.length === 0) {
      overdue.innerHTML = '<li>No hay prestamos vencidos.</li>';
    } else {
      overdue.innerHTML = data.alerts.overdueLoans
        .map(
          (item) =>
            `<li>${item.resource?.name || 'Recurso'} - ${item.requester?.name || 'Usuario'} - Vence: ${app.ui.formatDate(
              item.dueDate
            )}</li>`
        )
        .join('');
    }

    renderChart('loanStatusChart', data.charts.loanStatus, 'status');
    renderChart('reservationStatusChart', data.charts.reservationStatus, 'status');
    renderChart('resourceCategoryChart', data.charts.resourcesByCategory, 'category');
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'dashboard',
      title: 'Dashboard',
      subtitle: `Panel principal para ${app.config.roleLabels[app.auth.getUser()?.role] || 'usuario'}`
    });

    if (!user) return;

    try {
      await loadDashboard();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();
