(function bootstrapApi() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const buildUrl = (path) => {
    if (path.startsWith('http')) return path;
    const base = app.config.apiBaseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  };

  const request = async (path, options = {}) => {
    const {
      method = 'GET',
      body,
      headers = {},
      auth = true,
      responseType = 'json'
    } = options;

    const finalHeaders = { ...headers };

    if (auth) {
      const token = app.auth.getToken();
      if (token) {
        finalHeaders.Authorization = `Bearer ${token}`;
      }
    }

    let payload;
    if (body !== undefined && body !== null) {
      finalHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(buildUrl(path), {
      method,
      headers: finalHeaders,
      body: payload
    });

    if (response.status === 401 && auth) {
      app.auth.clearSession();
      app.auth.redirect('login.html');
      throw new Error('Sesion expirada');
    }

    if (!response.ok) {
      let message = `Error ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) message = errorData.message;
      } catch (error) {
        const plain = await response.text();
        if (plain) message = plain;
      }
      throw new Error(message);
    }

    if (responseType === 'blob') {
      return response.blob();
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  };

  app.api = {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' })
  };
})();
