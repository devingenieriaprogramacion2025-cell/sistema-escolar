(function bootstrapConfig() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  app.config = {
    apiBaseUrl: localStorage.getItem('school_api_base_url') || 'http://localhost:3000/api',
    storage: {
      token: 'school_token',
      user: 'school_user'
    },
    roleLabels: {
      ADMIN: 'Administrador',
      DIRECTIVO: 'Directivo',
      INSPECTORIA: 'Inspectoria',
      DOCENTE: 'Docente',
      ENCARGADO: 'Encargado'
    },
    pageAccess: {
      dashboard: ['ADMIN', 'DIRECTIVO', 'INSPECTORIA', 'DOCENTE', 'ENCARGADO'],
      usuarios: ['ADMIN'],
      inventario: ['ADMIN', 'DIRECTIVO', 'INSPECTORIA', 'DOCENTE', 'ENCARGADO'],
      prestamos: ['ADMIN', 'DIRECTIVO', 'INSPECTORIA', 'DOCENTE', 'ENCARGADO'],
      reservas: ['ADMIN', 'INSPECTORIA', 'DOCENTE', 'ENCARGADO'],
      solicitudes: ['DIRECTIVO'],
      impresiones: ['ADMIN', 'DIRECTIVO', 'INSPECTORIA', 'DOCENTE', 'ENCARGADO'],
      reportes: ['ADMIN', 'DIRECTIVO', 'INSPECTORIA']
    },
    menu: [
      { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: '##' },
      { key: 'usuarios', label: 'Usuarios', href: 'usuarios.html', icon: 'U' },
      { key: 'inventario', label: 'Inventario', href: 'inventario.html', icon: 'I' },
      { key: 'prestamos', label: 'Prestamos', href: 'prestamos.html', icon: 'P' },
      { key: 'reservas', label: 'Reservas', href: 'reservas.html', icon: 'R' },
      { key: 'solicitudes', label: 'Solicitudes', href: 'solicitudes.html', icon: 'S' },
      { key: 'impresiones', label: 'Impresiones', href: 'impresiones.html', icon: 'IM' },
      { key: 'reportes', label: 'Reportes y Auditoria', href: 'reportes.html', icon: 'RP' }
    ]
  };
})();
