// PAGINA RESERVAS: creacion y revision de reservas de recursos.
(function reservationsPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const state = {
    reservations: [],
    resources: [],
    users: []
  };

  const REQUESTER_NAMES = [
    '1 Basico',
    '2 Basico',
    '3 Basico',
    '4 Basico',
    '5 Basico',
    '6 Basico',
    '7 Basico',
    '8 Basico',
    'Profesores',
    'Administrativos'
  ];

  const normalizeText = (value = '') =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

  const canReview = () => ['ADMIN', 'INSPECTORIA'].includes(app.auth.getUser()?.role);
  const canCreate = () => ['ADMIN', 'INSPECTORIA', 'DOCENTE'].includes(app.auth.getUser()?.role);

  const loadResources = async () => {
    const response = await app.api.get('/resources?limit=100');
    state.resources = response.data;
    document.getElementById('resourceId').innerHTML = state.resources
      .map((item) => {
        const id = item._id || item.id;
        const code = item.code || item.codigo || '-';
        const name = item.name || item.nombre || '-';
        return `<option value="${id}">${code} - ${name}</option>`;
      })
      .join('');
  };

  const loadUsers = async () => {
    if (!canReview()) return;
    const response = await app.api.get('/users/operational');
    const usersByName = new Map(response.data.map((item) => [normalizeText(item.name || item.nombre || ''), item]));
    state.users = REQUESTER_NAMES.map((name) => usersByName.get(normalizeText(name))).filter(Boolean);

    document.getElementById('requesterId').innerHTML = ['<option value="">Usuario actual</option>']
      .concat(state.users.map((user) => `<option value="${user._id || user.id}">${user.name || user.nombre}</option>`))
      .join('');

    const missing = REQUESTER_NAMES.filter((name) => !usersByName.has(normalizeText(name)));
    if (missing.length > 0) {
      app.ui.showToast(`Faltan solicitantes configurados: ${missing.join(', ')}`, 'error');
    }
  };

  const renderReservations = () => {
    const tbody = document.getElementById('reservationsTableBody');
    const allowReview = canReview();

    tbody.innerHTML = state.reservations
      .map(
        (item) => `
          <tr>
            <td>${item.requester?.name || item.requester?.nombre || '-'}</td>
            <td>${item.resource?.name || item.resource?.nombre || '-'}</td>
            <td>${item.purpose || item.proposito || '-'}</td>
            <td>${app.ui.formatDate(item.startDate || item.fecha_inicio)} - ${app.ui.formatDate(item.endDate || item.fecha_fin)}</td>
            <td>${app.ui.badge(item.status || item.estado)}</td>
            <td>${item.reviewComments || item.comentarios_revision || '-'}</td>
            <td class="actions">
              ${
                allowReview && (item.status || item.estado) === 'PENDING'
                  ? `<button class="success" data-action="approve" data-id="${item._id || item.id}">Aprobar</button>
                     <button class="danger" data-action="reject" data-id="${item._id || item.id}">Rechazar</button>`
                  : '-'
              }
            </td>
          </tr>
        `
      )
      .join('');
  };

  const loadReservations = async () => {
    const response = await app.api.get('/reservations?limit=100');
    state.reservations = response.data;
    renderReservations();
  };

  const createReservation = async (event) => {
    event.preventDefault();

    const payload = {
      requesterId: document.getElementById('requesterId').value || undefined,
      resourceId: document.getElementById('resourceId').value,
      purpose: document.getElementById('purpose').value.trim(),
      startDate: document.getElementById('startDate').value,
      endDate: document.getElementById('endDate').value
    };

    await app.api.post('/reservations', payload);
    app.ui.showToast('Reserva enviada', 'success');
    event.target.reset();
    await loadReservations();
  };

  const reviewReservation = async (id, status) => {
    const reviewComments = window.prompt('Comentario de revision', status === 'APPROVED' ? 'Aprobada' : 'Rechazada') || '';
    await app.api.patch(`/reservations/${id}/review`, { status, reviewComments });
    app.ui.showToast('Reserva revisada', 'success');
    await loadReservations();
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'reservas',
      title: 'Reservas',
      subtitle: 'Solicitud y aprobacion de reservas de recursos'
    });

    if (!user) return;

    const form = document.getElementById('reservationForm');
    const formPanel = document.getElementById('reservationFormPanel');
    if (!canCreate()) {
      formPanel.classList.add('hidden');
    }

    if (!canReview()) {
      document.getElementById('requesterField').classList.add('hidden');
    }

    form.addEventListener('submit', async (event) => {
      try {
        await createReservation(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('reservationsTableBody').addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      try {
        if (button.dataset.action === 'approve') {
          await reviewReservation(button.dataset.id, 'APPROVED');
        }

        if (button.dataset.action === 'reject') {
          await reviewReservation(button.dataset.id, 'REJECTED');
        }
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await loadResources();
      await loadUsers();
      await loadReservations();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();

