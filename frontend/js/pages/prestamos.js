(function loansPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const state = {
    loans: [],
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

  const normalizeArea = (value = '') =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

  const isLibraryManager = (user) => user?.role === 'ENCARGADO' && normalizeArea(user.area) === 'BIBLIOTECA';
  const canCreateLoan = () => isLibraryManager(app.auth.getUser());
  const canManageLoan = () => isLibraryManager(app.auth.getUser());
  const canReturnLoan = () => ['ADMIN', 'INSPECTORIA'].includes(app.auth.getUser()?.role);

  const loadResources = async () => {
    const response = await app.api.get('/resources?limit=100');
    state.resources = response.data;

    const select = document.getElementById('resourceId');
    if (select) {
      select.innerHTML = state.resources
        .map((item) => `<option value="${item._id}">${item.code} - ${item.name} (${item.availableQuantity})</option>`)
        .join('');
    }
  };

  const loadUsers = async () => {
    if (!canCreateLoan()) return;
    const response = await app.api.get('/users/operational');
    const usersByName = new Map(response.data.map((item) => [normalizeText(item.name), item]));

    state.users = REQUESTER_NAMES.map((name) => usersByName.get(normalizeText(name))).filter(Boolean);

    const select = document.getElementById('requesterId');
    select.innerHTML = ['<option value="">Usuario actual</option>']
      .concat(state.users.map((item) => `<option value="${item._id}">${item.name}</option>`))
      .join('');

    const missing = REQUESTER_NAMES.filter((name) => !usersByName.has(normalizeText(name)));
    if (missing.length > 0) {
      app.ui.showToast(`Faltan solicitantes configurados: ${missing.join(', ')}`, 'error');
    }
  };

  const renderLoans = () => {
    const tbody = document.getElementById('loansTableBody');
    const allowManage = canManageLoan();
    const allowReturn = canReturnLoan();

    tbody.innerHTML = state.loans
      .map(
        (loan) => `
          <tr>
            <td>${loan.requester?.name || '-'}</td>
            <td>${loan.approvedBy?.name || '-'}</td>
            <td>${loan.resource?.name || '-'}</td>
            <td>${loan.quantity}</td>
            <td>${app.ui.formatDate(loan.startDate)}</td>
            <td>${app.ui.formatDate(loan.dueDate)}</td>
            <td>${app.ui.badge(loan.status)}</td>
            <td class="actions">
              ${
                allowManage && ['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.status)
                  ? `
                    <button class="secondary" data-action="edit" data-id="${loan._id}">Editar</button>
                    <button class="danger" data-action="deactivate" data-id="${loan._id}">Desactivar</button>
                  `
                  : allowReturn && ['ACTIVE', 'OVERDUE'].includes(loan.status)
                    ? `<button class="success" data-action="return" data-id="${loan._id}">Registrar devolucion</button>`
                    : '-'
              }
            </td>
          </tr>
        `
      )
      .join('');
  };

  const editLoan = async (loanId) => {
    const loan = state.loans.find((item) => item._id === loanId);
    if (!loan) throw new Error('Prestamo no encontrado');

    const dueDefault = loan.dueDate ? new Date(loan.dueDate).toISOString().slice(0, 10) : '';
    const dueDate = window.prompt('Nueva fecha de vencimiento (YYYY-MM-DD)', dueDefault);
    if (dueDate === null) return;

    const quantity = window.prompt('Nueva cantidad', String(loan.quantity || 1));
    if (quantity === null) return;

    const comments = window.prompt('Comentario (opcional)', loan.comments || '');
    if (comments === null) return;

    await app.api.patch(`/loans/${loanId}`, {
      dueDate: dueDate.trim(),
      quantity: Number(quantity),
      comments: comments.trim()
    });
    app.ui.showToast('Prestamo actualizado', 'success');
    await loadResources();
    await loadLoans();
  };

  const deactivateLoan = async (loanId) => {
    const confirmed = window.confirm('¿Seguro que deseas desactivar este prestamo?');
    if (!confirmed) return;

    await app.api.patch(`/loans/${loanId}/deactivate`, {});
    app.ui.showToast('Prestamo desactivado', 'success');
    await loadResources();
    await loadLoans();
  };

  const loadLoans = async () => {
    const response = await app.api.get('/loans?limit=100');
    state.loans = response.data;
    renderLoans();
  };

  const createLoan = async (event) => {
    event.preventDefault();

    const payload = {
      requesterId: document.getElementById('requesterId').value || undefined,
      resourceId: document.getElementById('resourceId').value,
      quantity: Number(document.getElementById('quantity').value),
      dueDate: document.getElementById('dueDate').value,
      comments: document.getElementById('comments').value.trim()
    };

    await app.api.post('/loans', payload);
    app.ui.showToast('Prestamo registrado', 'success');
    event.target.reset();
    await loadResources();
    await loadLoans();
  };

  const handleTableActions = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'return') {
      await app.api.patch(`/loans/${button.dataset.id}/return`, {});
      app.ui.showToast('Prestamo cerrado', 'success');
      await loadResources();
      await loadLoans();
      return;
    }

    if (button.dataset.action === 'edit') {
      await editLoan(button.dataset.id);
      return;
    }

    if (button.dataset.action === 'deactivate') {
      await deactivateLoan(button.dataset.id);
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'prestamos',
      title: 'Prestamos',
      subtitle: 'Control y trazabilidad de prestamos de recursos'
    });

    if (!user) return;

    const form = document.getElementById('loanForm');
    const formPanel = document.getElementById('loanFormPanel');
    if (!canCreateLoan()) {
      formPanel.classList.add('hidden');
    }

    form.addEventListener('submit', async (event) => {
      try {
        await createLoan(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('loansTableBody').addEventListener('click', async (event) => {
      try {
        await handleTableActions(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await loadResources();
      await loadUsers();
      await loadLoans();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();
