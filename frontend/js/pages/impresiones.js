// PAGINA IMPRESIONES: listado, creacion y revision de solicitudes de impresion.
(function printsPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const state = {
    items: []
  };

  const normalizeArea = (value = '') =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

  const isLibraryManager = () => {
    const user = app.auth.getUser();
    return user?.role === 'ENCARGADO' && normalizeArea(user.area) === 'BIBLIOTECA';
  };

  const canReview = () => isLibraryManager();
  const canCreate = () => ['ADMIN', 'DIRECTIVO', 'INSPECTORIA', 'DOCENTE'].includes(app.auth.getUser()?.role) || isLibraryManager();

  const render = () => {
    const tbody = document.getElementById('printsTableBody');

    tbody.innerHTML = state.items
      .map(
        (item) => `
          <tr>
            <td>${item.requester?.name || item.requester?.nombre || '-'}</td>
            <td>${item.documentName || item.nombre_documento || '-'}</td>
            <td>${item.pages ?? item.paginas ?? '-'}</td>
            <td>${item.copies ?? item.copias ?? '-'}</td>
            <td>${(item.color ?? item.es_color) ? 'Color' : 'B/N'} / ${(item.doubleSided ?? item.doble_cara) ? 'Doble cara' : 'Simple'}</td>
            <td>${app.ui.badge(item.status || item.estado)}</td>
            <td class="actions">
              ${canReview() && (item.status || item.estado) === 'PENDING' ? `<button class="secondary" data-action="review" data-id="${item._id}">Revisar</button>` : '-'}
            </td>
          </tr>
        `
      )
      .join('');
  };

  const loadPrints = async () => {
    const response = await app.api.get('/prints?limit=100');
    state.items = response.data;
    render();
  };

  const createPrint = async (event) => {
    event.preventDefault();

    const payload = {
      documentName: document.getElementById('documentName').value.trim(),
      pages: Number(document.getElementById('pages').value),
      copies: Number(document.getElementById('copies').value),
      color: document.getElementById('color').checked,
      doubleSided: document.getElementById('doubleSided').checked
    };

    await app.api.post('/prints', payload);
    app.ui.showToast('Solicitud de impresion creada', 'success');
    event.target.reset();
    await loadPrints();
  };

  const reviewPrint = async (id) => {
    const status = window.prompt('Nuevo estado (APPROVED, REJECTED, DONE)', 'APPROVED');
    if (!status) return;
    const reviewComments = window.prompt('Comentario', 'Revision de impresion') || '';

    await app.api.patch(`/prints/${id}/review`, { status, reviewComments });
    app.ui.showToast('Solicitud actualizada', 'success');
    await loadPrints();
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const user = app.ui.initPage({
      pageKey: 'impresiones',
      title: 'Control de Impresiones',
      subtitle: 'Gestion de solicitudes de impresion institucional'
    });

    if (!user) return;

    const form = document.getElementById('printForm');
    const formPanel = document.getElementById('printFormPanel');
    if (!canCreate()) {
      formPanel.classList.add('hidden');
    }

    form.addEventListener('submit', async (event) => {
      try {
        await createPrint(event);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    document.getElementById('printsTableBody').addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action="review"]');
      if (!button) return;

      try {
        await reviewPrint(button.dataset.id);
      } catch (error) {
        app.ui.showToast(error.message, 'error');
      }
    });

    try {
      await loadPrints();
    } catch (error) {
      app.ui.showToast(error.message, 'error');
    }
  });
})();

