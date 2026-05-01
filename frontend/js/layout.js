(function bootstrapLayout() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const statusClass = (value) => String(value || '').toLowerCase().replace(/\s+/g, '_');

  const showToast = (message, type = 'info') => {
    const root = document.getElementById('toast');
    if (!root) return;

    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    root.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 3200);
  };

  const badge = (value) => `<span class="badge ${statusClass(value)}">${value || 'N/A'}</span>`;

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const formatNumber = (value) => new Intl.NumberFormat('es-CL').format(Number(value || 0));

  const renderSidebar = (pageKey, user) => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const availableItems = app.config.menu.filter((item) => app.config.pageAccess[item.key]?.includes(user.role));

    const links = availableItems
      .map(
        (item) => `
          <a href="${item.href}" class="${item.key === pageKey ? 'active' : ''}">
            <span class="icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `
      )
      .join('');

    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <h2>Sistema Escolar</h2>
      <small>Gestion Interna de Recursos</small>
      <nav class="menu">${links}</nav>
    `;
  };

  const renderTopbar = ({ title, subtitle }, user) => {
    const topbar = document.getElementById('topbar');
    if (!topbar) return;

    const initials = `${user.name || 'U'}`
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    topbar.className = 'topbar';
    topbar.innerHTML = `
      <div>
        <h1>${title}</h1>
        <p>${subtitle || 'Sistema web de gestion y operaciones internas escolares'}</p>
      </div>
      <div class="user-chip">
        <div class="user-avatar">${initials}</div>
        <div>
          <strong>${user.name}</strong><br>
          <small>${app.config.roleLabels[user.role] || user.role}</small>
        </div>
        <button id="logoutBtn" class="secondary">Salir</button>
      </div>
    `;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', app.auth.logout);
    }
  };

  const initPage = ({ pageKey, title, subtitle }) => {
    const allowed = app.config.pageAccess[pageKey] || [];
    const user = app.auth.requireAuth(allowed);
    if (!user) return null;

    renderSidebar(pageKey, user);
    renderTopbar({ title, subtitle }, user);

    return user;
  };

  app.ui = {
    initPage,
    showToast,
    badge,
    formatDate,
    formatDateTime,
    formatNumber
  };
})();
