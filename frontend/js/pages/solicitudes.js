// PAGINA SOLICITUDES: flujo de solicitudes internas y su aprobacion/rechazo.
(function requestsPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const state = {
    items: []
  };

  const canReview = () => app.auth.getUser()?.role === 'DIRECTIVO';
  const canCreate = () => false;

  const render = () => {
    const tbody = document.getElementById('requestsTableBody');

    tbody.innerHTML = state.items
      .map(
        (item) => `
          <tr>
            <td>${item.requester?.name || '-'}</td>
            <td>${item.title}</td>
            <td>${item.priority}</td>
            <td>${app.ui.badge(item.status)}</td>
            <td>${item.reviewComments || '-'}</td>
            <td>${app.ui.formatDate(item.createdAt)}</td>
            <td class="actions">
              ${
                canReview() && item.status === 'PENDING'
                  ? `
                    <button class="success" data-action="approve" data-id="${item._id}">Aprobar</button>
                    <button class="danger" data-action="reject" data-id="${item._id}">Rechazar</button>
                  `
                  : '-'
              }
            </td>
          </tr>
        `
      )
      .join('');
  };

  const loadRequests = async () => {
    const response = await app.api.get('/requests?limit=100');
    state.items = response.data;
    render();
  };

  const createRequest = async (event) => {
    event.preventDefault();

    const payload = {
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      priority: document.getElementById('priority').value
    };

    await app.api.post('/requests', payload);
    app.ui.showToast('Solicitud creada', 'success');
    event.target.reset();
    await loadRequests();
  };

  const reviewRequest = async (id, status) => {
    const reviewComments = window.prompt('Comentario', status === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada') || '';

    await app.api.patch(`/requests/${id}/review`, { status, reviewComments });
    app.ui.showToast('Solicitud actualizada', 'success');
    await loadRequests();
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'solicitudes',
      title: 'Solicitudes Internas',
      subtitle: 'Registro de requerimientos internos por area'
    });

    if (!user) return;

    const form = document.getElementById('requestForm');
    const formPanel = document.getElementById('requestFormPanel');
    if (!canCreate()) {
      formPanel.classList.add('hidden');
    }

    form.addEventListener('submit', async (event) => {
      try {
        await createRequest(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('requestsTableBody').addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      try {
        if (button.dataset.action === 'approve') {
          await reviewRequest(button.dataset.id, 'APPROVED');
        }

        if (button.dataset.action === 'reject') {
          await reviewRequest(button.dataset.id, 'REJECTED');
        }
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await loadRequests();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();

