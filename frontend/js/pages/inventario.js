(function inventoryPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const state = {
    resources: [],
    categories: []
  };

  const canManageResources = () => {
    const role = app.auth.getUser()?.role;
    return ['ADMIN', 'INSPECTORIA', 'ENCARGADO'].includes(role);
  };

  const canManageCategories = () => {
    const role = app.auth.getUser()?.role;
    return ['ADMIN', 'INSPECTORIA'].includes(role);
  };

  const loadCategories = async () => {
    const response = await app.api.get('/resources/categories');
    state.categories = response.data;

    const categorySelect = document.getElementById('categoryId');
    const queryCategory = document.getElementById('queryCategoryId');

    const options = ['<option value="">Todas</option>']
      .concat(state.categories.map((item) => `<option value="${item._id}">${item.name}</option>`))
      .join('');

    queryCategory.innerHTML = options;
    categorySelect.innerHTML = state.categories.map((item) => `<option value="${item._id}">${item.name}</option>`).join('');
  };

  const renderResources = () => {
    const tbody = document.getElementById('resourcesTableBody');
    const canManage = canManageResources();

    tbody.innerHTML = state.resources
      .map(
        (item) => `
          <tr>
            <td>${item.code}</td>
            <td>${item.name}</td>
            <td>${item.category?.name || '-'}</td>
            <td>${item.area}</td>
            <td>${item.availableQuantity} / ${item.totalQuantity}</td>
            <td>${item.location || '-'}</td>
            <td>${app.ui.badge(item.status)}</td>
            <td class="actions">
              ${
                canManage
                  ? `<button class="secondary" data-action="edit" data-id="${item._id}">Editar</button>
                     <button class="danger" data-action="delete" data-id="${item._id}">Desactivar</button>`
                  : '-'
              }
            </td>
          </tr>
        `
      )
      .join('');
  };

  const loadResources = async () => {
    const query = new URLSearchParams();
    const q = document.getElementById('queryText').value.trim();
    const categoryId = document.getElementById('queryCategoryId').value;

    if (q) query.set('q', q);
    if (categoryId) query.set('categoryId', categoryId);
    query.set('limit', '100');

    const response = await app.api.get(`/resources?${query.toString()}`);
    state.resources = response.data;
    renderResources();
  };

  const createResource = async (event) => {
    event.preventDefault();

    const payload = {
      code: document.getElementById('code').value.trim(),
      name: document.getElementById('name').value.trim(),
      categoryId: document.getElementById('categoryId').value,
      area: document.getElementById('area').value.trim(),
      location: document.getElementById('location').value.trim(),
      totalQuantity: Number(document.getElementById('totalQuantity').value),
      availableQuantity: Number(document.getElementById('availableQuantity').value),
      minStock: Number(document.getElementById('minStock').value || 0),
      price: Number(document.getElementById('price').value || 0),
      description: document.getElementById('description').value.trim()
    };

    await app.api.post('/resources', payload);
    app.ui.showToast('Recurso creado', 'success');
    event.target.reset();
    await loadResources();
  };

  const createCategory = async (event) => {
    event.preventDefault();

    const payload = {
      name: document.getElementById('categoryName').value.trim(),
      description: document.getElementById('categoryDescription').value.trim()
    };

    await app.api.post('/resources/categories', payload);
    app.ui.showToast('Categoria creada', 'success');
    event.target.reset();
    await loadCategories();
    await loadResources();
  };

  const tableActions = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const selected = state.resources.find((item) => item._id === id);
    if (!selected) return;

    if (action === 'delete') {
      if (!window.confirm('Deseas desactivar este recurso?')) return;
      await app.api.delete(`/resources/${id}`);
      app.ui.showToast('Recurso desactivado', 'success');
      await loadResources();
      return;
    }

    if (action === 'edit') {
      const name = window.prompt('Nombre', selected.name);
      if (name === null) return;
      const area = window.prompt('Area', selected.area);
      if (area === null) return;
      const location = window.prompt('Ubicacion', selected.location || '');
      if (location === null) return;

      await app.api.put(`/resources/${id}`, { name, area, location });
      app.ui.showToast('Recurso actualizado', 'success');
      await loadResources();
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'inventario',
      title: 'Inventario de Recursos',
      subtitle: 'Control de materiales, equipos y stock institucional'
    });

    if (!user) return;

    const resourcePanel = document.getElementById('resourceFormPanel');
    const categoryPanel = document.getElementById('categoryFormPanel');
    const resourceForm = document.getElementById('resourceForm');
    const categoryForm = document.getElementById('categoryForm');

    if (!canManageResources()) {
      resourcePanel.classList.add('hidden');
    }

    if (!canManageCategories()) {
      categoryPanel.classList.add('hidden');
    }

    document.getElementById('searchResources').addEventListener('click', async () => {
      try {
        await loadResources();
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    resourceForm.addEventListener('submit', async (event) => {
      try {
        await createResource(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    categoryForm.addEventListener('submit', async (event) => {
      try {
        await createCategory(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('resourcesTableBody').addEventListener('click', async (event) => {
      try {
        await tableActions(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await loadCategories();
      await loadResources();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();
