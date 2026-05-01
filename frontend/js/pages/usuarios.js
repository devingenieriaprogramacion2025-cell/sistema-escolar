(function usersPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const state = {
    users: [],
    roles: []
  };

  const fillRoleSelect = (elementId, roles) => {
    const select = document.getElementById(elementId);
    if (!select) return;

    select.innerHTML = roles.map((role) => `<option value="${role._id}">${role.name}</option>`).join('');
  };

  const loadRoles = async () => {
    const response = await app.api.get('/users/roles');
    state.roles = response.data;
    fillRoleSelect('roleId', state.roles);
  };

  const renderUsers = () => {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.users
      .map(
        (user) => `
          <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role?.name || '-'}</td>
            <td>${user.area || '-'}</td>
            <td>${app.ui.badge(user.status)}</td>
            <td>${app.ui.formatDate(user.createdAt)}</td>
            <td class="actions">
              <button data-action="edit" data-id="${user._id}" class="secondary">Editar</button>
              <button data-action="status" data-id="${user._id}" class="warn">${
          user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'
        }</button>
            </td>
          </tr>
        `
      )
      .join('');
  };

  const loadUsers = async () => {
    const response = await app.api.get('/users?limit=100');
    state.users = response.data;
    renderUsers();
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value.trim(),
      roleId: document.getElementById('roleId').value,
      area: document.getElementById('area').value.trim(),
      phone: document.getElementById('phone').value.trim()
    };

    await app.api.post('/users', payload);
    app.ui.showToast('Usuario creado', 'success');
    event.target.reset();
    fillRoleSelect('roleId', state.roles);
    await loadUsers();
  };

  const handleTableActions = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const userId = button.dataset.id;
    const action = button.dataset.action;
    const current = state.users.find((item) => item._id === userId);
    if (!current) return;

    if (action === 'status') {
      const status = current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await app.api.patch(`/users/${userId}/status`, { status });
      app.ui.showToast('Estado actualizado', 'success');
      await loadUsers();
      return;
    }

    if (action === 'edit') {
      const name = window.prompt('Nombre del usuario', current.name);
      if (name === null) return;
      const area = window.prompt('Area', current.area || 'General');
      if (area === null) return;
      const phone = window.prompt('Telefono', current.phone || '');
      if (phone === null) return;

      await app.api.put(`/users/${userId}`, { name, area, phone });
      app.ui.showToast('Usuario actualizado', 'success');
      await loadUsers();
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'usuarios',
      title: 'Gestion de Usuarios',
      subtitle: 'Creacion y administracion de cuentas institucionales'
    });

    if (!user) return;

    document.getElementById('createUserForm').addEventListener('submit', async (event) => {
      try {
        await handleCreate(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('usersTableBody').addEventListener('click', async (event) => {
      try {
        await handleTableActions(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await Promise.all([loadRoles(), loadUsers()]);
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();
