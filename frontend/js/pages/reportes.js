// PAGINA REPORTES: resumen estadistico, exportacion y vista de auditoria.
(function reportsPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const loadSummary = async () => {
    const query = new URLSearchParams();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;

    if (from) query.set('from', from);
    if (to) query.set('to', to);

    const response = await app.api.get(`/reports/summary?${query.toString()}`);
    const data = response.data;

    document.getElementById('reportResources').textContent = app.ui.formatNumber(data.totals.resources);
    document.getElementById('reportLoans').textContent = app.ui.formatNumber(data.totals.loans);
    document.getElementById('reportReservations').textContent = app.ui.formatNumber(data.totals.reservations);
    document.getElementById('reportRequests').textContent = app.ui.formatNumber(data.totals.internalRequests);
    document.getElementById('reportPrints').textContent = app.ui.formatNumber(data.totals.printRequests);
    document.getElementById('reportPages').textContent = app.ui.formatNumber(data.totals.totalPrintedPages);

    const topResourceBody = document.getElementById('topResourcesBody');
    topResourceBody.innerHTML = data.topResources
      .map(
        (item) => `
          <tr>
            <td>${item.resourceCode}</td>
            <td>${item.resourceName}</td>
            <td>${item.totalQuantity}</td>
          </tr>
        `
      )
      .join('');

    if (data.topResources.length === 0) {
      topResourceBody.innerHTML = '<tr><td colspan="3">No hay datos para este rango.</td></tr>';
    }
  };

  const exportPdf = async () => {
    const query = new URLSearchParams();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;

    if (from) query.set('from', from);
    if (to) query.set('to', to);

    const blob = await app.api.get(`/reports/export?${query.toString()}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-sistema-escolar-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const loadAudit = async () => {
    const user = app.auth.getUser();
    if (user.role !== 'ADMIN') {
      document.getElementById('auditPanel').classList.add('hidden');
      return;
    }

    const response = await app.api.get('/audit-logs?limit=40');
    const rows = response.data;

    document.getElementById('auditTableBody').innerHTML = rows
      .map(
        (item) => `
          <tr>
            <td>${app.ui.formatDateTime(item.createdAt)}</td>
            <td>${item.userEmail}</td>
            <td>${item.module || item.modulo || '-'}</td>
            <td>${item.action || item.accion || '-'}</td>
            <td>${app.ui.badge(item.status || item.estado || 'N/A')}</td>
          </tr>
        `
      )
      .join('');
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'reportes',
      title: 'Reportes y Auditoria',
      subtitle: 'Analitica operativa, exportacion PDF e historial de acciones'
    });

    if (!user) return;

    document.getElementById('filterBtn').addEventListener('click', async () => {
      try {
        await loadSummary();
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('exportBtn').addEventListener('click', async () => {
      try {
        await exportPdf();
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await loadSummary();
      await loadAudit();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();

