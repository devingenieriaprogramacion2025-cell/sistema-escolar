// AUTENTICACION CLIENTE: maneja sesion local, permisos basicos y redirecciones.
(function bootstrapAuth() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const getToken = () => localStorage.getItem(app.config.storage.token);

  const getUser = () => {
    const raw = localStorage.getItem(app.config.storage.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  };

  const saveSession = ({ token, user }) => {
    localStorage.setItem(app.config.storage.token, token);
    localStorage.setItem(app.config.storage.user, JSON.stringify(user));
  };

  const clearSession = () => {
    localStorage.removeItem(app.config.storage.token);
    localStorage.removeItem(app.config.storage.user);
  };

  const redirect = (path) => {
    window.location.href = path;
  };

  const isAuthenticated = () => Boolean(getToken() && getUser());

  const hasRole = (allowedRoles) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const user = getUser();
    return user ? allowedRoles.includes(user.role) : false;
  };

  const requireAuth = (allowedRoles) => {
    if (!isAuthenticated()) {
      redirect('login.html');
      return null;
    }

    const user = getUser();

    if (!hasRole(allowedRoles)) {
      redirect('dashboard.html');
      return null;
    }

    return user;
  };

  const logout = () => {
    clearSession();
    redirect('login.html');
  };

  app.auth = {
    getToken,
    getUser,
    saveSession,
    clearSession,
    isAuthenticated,
    hasRole,
    requireAuth,
    logout,
    redirect
  };
})();

