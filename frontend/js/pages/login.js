(function loginPage() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  document.addEventListener('DOMContentLoaded', () => {
    if (app.auth.isAuthenticated()) {
      app.auth.redirect('dashboard.html');
      return;
    }

    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      errorBox.textContent = '';

      try {
        const response = await app.api.post('/auth/login', { email, password }, { auth: false });
        app.auth.saveSession({ token: response.token, user: response.user });
        app.auth.redirect('dashboard.html');
      } catch (error) {
        errorBox.textContent = error.message || 'No se pudo iniciar sesion';
      }
    });
  });
})();
