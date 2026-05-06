// API ESTATICA: simula los endpoints del sistema usando localStorage para funcionar sin backend.
(function bootstrapApi() {
  const app = (window.SchoolApp = window.SchoolApp || {});

  const STORAGE_KEY = 'school_static_db_v1';
  const TOKEN_PREFIX = 'static-token-';

  const STATIC_PERMISSIONS = Object.freeze({
    ADMIN: ['*'],
    DIRECTIVO: [
      'DASHBOARD:READ',
      'REPORTS:READ',
      'REPORTS:EXPORT',
      'RESOURCES:READ',
      'LOANS:READ',
      'REQUESTS:READ',
      'REQUESTS:REVIEW',
      'PRINTS:READ',
      'PRINTS:CREATE'
    ],
    INSPECTORIA: [
      'DASHBOARD:READ',
      'RESOURCES:READ',
      'RESOURCES:WRITE',
      'LOANS:READ',
      'LOANS:WRITE',
      'RESERVATIONS:READ',
      'RESERVATIONS:WRITE',
      'REQUESTS:READ',
      'REQUESTS:WRITE',
      'PRINTS:READ',
      'PRINTS:WRITE',
      'AUDIT:READ'
    ],
    DOCENTE: [
      'DASHBOARD:READ',
      'RESOURCES:READ',
      'LOANS:READ_OWN',
      'RESERVATIONS:READ_OWN',
      'RESERVATIONS:CREATE',
      'REQUESTS:READ_OWN',
      'REQUESTS:CREATE',
      'PRINTS:READ_OWN',
      'PRINTS:CREATE'
    ],
    ENCARGADO: [
      'DASHBOARD:READ',
      'RESOURCES:READ',
      'RESOURCES:WRITE_AREA',
      'LOANS:READ',
      'RESERVATIONS:READ',
      'PRINTS:READ',
      'PRINTS:CREATE',
      'PRINTS:REVIEW'
    ]
  });

  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const nowIso = () => new Date().toISOString();
  const todayIsoDate = () => nowIso().slice(0, 10);

  const parsePagination = (url) => {
    const page = Math.max(Number(url.searchParams.get('page') || 1), 1);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 10), 1), 200);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  };

  const seedDb = () => {
    const roles = [
      { id: 1, name: 'ADMIN', description: 'Rol ADMIN', status: 'ACTIVE' },
      { id: 2, name: 'DIRECTIVO', description: 'Rol DIRECTIVO', status: 'ACTIVE' },
      { id: 3, name: 'INSPECTORIA', description: 'Rol INSPECTORIA', status: 'ACTIVE' },
      { id: 4, name: 'DOCENTE', description: 'Rol DOCENTE', status: 'ACTIVE' },
      { id: 5, name: 'ENCARGADO', description: 'Rol ENCARGADO', status: 'ACTIVE' }
    ].map((item) => ({ ...item, createdAt: nowIso(), updatedAt: nowIso() }));

    const users = [
      ['Administrador General', 'admin@admin.com', 1, 'Administracion'],
      ['Director Academico', 'directivo@colegio.com', 2, 'Direccion'],
      ['Inspector General', 'inspectoria@colegio.com', 3, 'Convivencia'],
      ['Docente Demo', 'docente@colegio.com', 4, 'Matematicas'],
      ['Encargado Biblioteca', 'encargado@colegio.com', 5, 'Biblioteca'],
      ['1 Basico', '1basico@colegio.com', 4, '1 Basico'],
      ['2 Basico', '2basico@colegio.com', 4, '2 Basico'],
      ['3 Basico', '3basico@colegio.com', 4, '3 Basico'],
      ['4 Basico', '4basico@colegio.com', 4, '4 Basico'],
      ['5 Basico', '5basico@colegio.com', 4, '5 Basico'],
      ['6 Basico', '6basico@colegio.com', 4, '6 Basico'],
      ['7 Basico', '7basico@colegio.com', 4, '7 Basico'],
      ['8 Basico', '8basico@colegio.com', 4, '8 Basico'],
      ['Profesores', 'profesores@colegio.com', 4, 'Profesores'],
      ['Administrativos', 'administrativos@colegio.com', 4, 'Administrativos']
    ].map((item, index) => ({
      id: index + 1,
      name: item[0],
      email: item[1],
      password: '123456',
      roleId: item[2],
      area: item[3],
      phone: '',
      status: 'ACTIVE',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }));

    const categories = [
      ['Tecnologia', 'Computadores y equipos audiovisuales'],
      ['Laboratorio', 'Materiales de laboratorio'],
      ['Biblioteca', 'Material bibliografico'],
      ['Oficina', 'Insumos de oficina e impresion']
    ].map((item, index) => ({
      id: index + 1,
      name: item[0],
      description: item[1],
      status: 'ACTIVE',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }));

    const resources = [
      ['REC-001', 'Proyector Epson', 1, 'Proyector multimedia para sala de clases', 'Tecnologia', 'Bodega T1', 'unidad', 8, 6, 2, 450000],
      ['REC-002', 'Notebook Dell', 1, 'Equipo de apoyo para docentes', 'Tecnologia', 'Bodega T2', 'unidad', 20, 14, 4, 620000],
      ['REC-003', 'Kit de Laboratorio Quimica', 2, 'Set de tubos, reactivos y soporte', 'Laboratorio', 'Lab 1', 'kit', 15, 10, 5, 90000],
      ['REC-004', 'Resma Carta', 4, 'Papel para impresiones internas', 'Administracion', 'Archivo Central', 'resma', 60, 24, 20, 4500],
      ['REC-005', 'Set Libros Lectura Complementaria', 3, 'Coleccion para prestamo docente', 'Biblioteca', 'Estante B4', 'set', 35, 31, 8, 25000]
    ].map((item, index) => ({
      id: index + 1,
      code: item[0],
      name: item[1],
      categoryId: item[2],
      description: item[3],
      area: item[4],
      location: item[5],
      unit: item[6],
      totalQuantity: item[7],
      availableQuantity: item[8],
      minStock: item[9],
      price: item[10],
      status: 'ACTIVE',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }));

    return {
      roles,
      users,
      categories,
      resources,
      loans: [],
      reservations: [],
      internalRequests: [],
      printRequests: [],
      auditLogs: [],
      nextIds: {
        users: users.length + 1,
        categories: categories.length + 1,
        resources: resources.length + 1,
        loans: 1,
        reservations: 1,
        internalRequests: 1,
        printRequests: 1,
        auditLogs: 1
      }
    };
  };

  const loadDb = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedDb();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      const seeded = seedDb();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
  };

  const saveDb = (db) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  };

  const roleById = (db, roleId) => db.roles.find((item) => Number(item.id) === Number(roleId));
  const categoryById = (db, categoryId) => db.categories.find((item) => Number(item.id) === Number(categoryId));
  const userById = (db, userId) => db.users.find((item) => Number(item.id) === Number(userId));
  const resourceById = (db, resourceId) => db.resources.find((item) => Number(item.id) === Number(resourceId));

  const toRole = (role) => ({
    _id: String(role.id),
    id: String(role.id),
    name: role.name,
    description: role.description,
    status: role.status,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt
  });

  const toUser = (db, user) => {
    const role = roleById(db, user.roleId);
    return {
      _id: String(user.id),
      id: String(user.id),
      name: user.name,
      email: user.email,
      area: user.area,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: role ? { _id: String(role.id), id: String(role.id), name: role.name } : null
    };
  };

  const toCategory = (category) => ({
    _id: String(category.id),
    id: String(category.id),
    name: category.name,
    description: category.description,
    status: category.status,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  });

  const toResource = (db, resource) => {
    const category = categoryById(db, resource.categoryId);
    return {
      _id: String(resource.id),
      id: String(resource.id),
      code: resource.code,
      name: resource.name,
      category: category ? { _id: String(category.id), id: String(category.id), name: category.name } : null,
      description: resource.description,
      area: resource.area,
      location: resource.location,
      unit: resource.unit,
      totalQuantity: Number(resource.totalQuantity),
      availableQuantity: Number(resource.availableQuantity),
      minStock: Number(resource.minStock),
      price: Number(resource.price),
      status: resource.status,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt
    };
  };

  const toLoan = (db, loan) => ({
    _id: String(loan.id),
    id: String(loan.id),
    quantity: Number(loan.quantity),
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    returnedDate: loan.returnedDate || null,
    comments: loan.comments || '',
    status: loan.status,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    requester: loan.requesterId ? toUser(db, userById(db, loan.requesterId)) : null,
    resource: loan.resourceId ? toResource(db, resourceById(db, loan.resourceId)) : null,
    approvedBy: loan.approvedBy ? toUser(db, userById(db, loan.approvedBy)) : null
  });

  const toReservation = (db, reservation) => ({
    _id: String(reservation.id),
    id: String(reservation.id),
    purpose: reservation.purpose,
    startDate: reservation.startDate,
    endDate: reservation.endDate,
    reviewComments: reservation.reviewComments || '',
    status: reservation.status,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    requester: reservation.requesterId ? toUser(db, userById(db, reservation.requesterId)) : null,
    resource: reservation.resourceId ? toResource(db, resourceById(db, reservation.resourceId)) : null,
    reviewedBy: reservation.reviewedBy ? toUser(db, userById(db, reservation.reviewedBy)) : null
  });

  const toInternalRequest = (db, item) => ({
    _id: String(item.id),
    id: String(item.id),
    title: item.title,
    description: item.description,
    priority: item.priority,
    reviewComments: item.reviewComments || '',
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    requester: item.requesterId ? toUser(db, userById(db, item.requesterId)) : null,
    reviewedBy: item.reviewedBy ? toUser(db, userById(db, item.reviewedBy)) : null
  });

  const toPrintRequest = (db, item) => ({
    _id: String(item.id),
    id: String(item.id),
    documentName: item.documentName,
    pages: Number(item.pages),
    copies: Number(item.copies),
    color: Boolean(item.color),
    doubleSided: Boolean(item.doubleSided),
    reviewComments: item.reviewComments || '',
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    requester: item.requesterId ? toUser(db, userById(db, item.requesterId)) : null,
    reviewedBy: item.reviewedBy ? toUser(db, userById(db, item.reviewedBy)) : null
  });

  const toAuditLog = (db, item) => ({
    _id: String(item.id),
    id: String(item.id),
    userEmail: item.userEmail,
    role: item.role,
    action: item.action,
    module: item.module,
    entityId: item.entityId,
    details: clone(item.details || {}),
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    user: item.userId ? toUser(db, userById(db, item.userId)) : null
  });

  const addAudit = (db, actorUser, action, module, entityId, details = {}, status = 'SUCCESS') => {
    const user = actorUser || null;
    db.auditLogs.push({
      id: db.nextIds.auditLogs++,
      userId: user ? Number(user.id) : null,
      userEmail: user?.email || 'system',
      role: user?.role || 'SYSTEM',
      action,
      module,
      entityId: entityId ? String(entityId) : null,
      details: clone(details),
      status,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  };

  const buildMeta = (total, page, limit) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });

  const ensureAuthUser = () => {
    if (!app.auth?.isAuthenticated?.()) {
      throw new Error('Sesion expirada');
    }
    const user = app.auth.getUser();
    if (!user) {
      throw new Error('Sesion expirada');
    }
    return user;
  };

  const splitPath = (inputPath) => {
    const clean = inputPath.startsWith('http') ? inputPath : `http://local${inputPath.startsWith('/') ? inputPath : `/${inputPath}`}`;
    return new URL(clean);
  };

  const parseMaybeDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const applyCreatedAtRange = (rows, from, to) => {
    const fromDate = parseMaybeDate(from);
    const toDate = parseMaybeDate(to);
    if (!fromDate && !toDate) return rows;

    return rows.filter((item) => {
      const created = new Date(item.createdAt || item.created_at || nowIso());
      if (fromDate && created < fromDate) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      return true;
    });
  };

  const buildDashboardData = (db, sessionUser) => {
    const user = sessionUser;
    const isDocente = user.role === 'DOCENTE';
    const isEncargado = user.role === 'ENCARGADO';

    const scopedResources = db.resources.filter((item) => {
      if (isEncargado) return item.area === user.area;
      return true;
    });

    const scopedResourceIds = new Set(scopedResources.map((item) => Number(item.id)));

    const scopedLoans = db.loans.filter((item) => {
      if (isDocente) return Number(item.requesterId) === Number(user.id);
      if (isEncargado) return scopedResourceIds.has(Number(item.resourceId));
      return true;
    });

    const scopedReservations = db.reservations.filter((item) => {
      if (isDocente) return Number(item.requesterId) === Number(user.id);
      if (isEncargado) return scopedResourceIds.has(Number(item.resourceId));
      return true;
    });

    const scopedRequests = db.internalRequests.filter((item) => {
      if (isDocente) return Number(item.requesterId) === Number(user.id);
      return true;
    });

    const scopedPrints = db.printRequests.filter((item) => {
      if (isDocente) return Number(item.requesterId) === Number(user.id);
      return true;
    });

    const lowStock = scopedResources
      .filter((item) => item.status === 'ACTIVE' && Number(item.availableQuantity) <= Number(item.minStock))
      .slice(0, 8)
      .map((item) => toResource(db, item));

    const now = new Date();
    const overdueLoans = scopedLoans
      .filter((item) => ['ACTIVE', 'OVERDUE'].includes(item.status) && new Date(item.dueDate) < now)
      .slice(0, 8)
      .map((item) => toLoan(db, item));

    const groupByStatus = (rows) =>
      Object.entries(
        rows.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {})
      ).map(([status, total]) => ({ status, total }));

    const resourcesByCategoryMap = scopedResources.reduce((acc, item) => {
      const category = categoryById(db, item.categoryId);
      const key = category?.name || 'Sin categoria';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const resourcesByCategory = Object.entries(resourcesByCategoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return {
      totals: {
        resources: scopedResources.filter((item) => item.status === 'ACTIVE').length,
        activeLoans: scopedLoans.filter((item) => ['ACTIVE', 'OVERDUE'].includes(item.status)).length,
        pendingReservations: scopedReservations.filter((item) => item.status === 'PENDING').length,
        pendingInternalRequests: scopedRequests.filter((item) => ['PENDING', 'IN_PROGRESS'].includes(item.status)).length,
        pendingPrintRequests: scopedPrints.filter((item) => item.status === 'PENDING').length
      },
      alerts: {
        lowStock,
        overdueLoans
      },
      charts: {
        loanStatus: groupByStatus(scopedLoans),
        reservationStatus: groupByStatus(scopedReservations),
        resourcesByCategory
      }
    };
  };

  const buildSummaryData = (db, sessionUser, url) => {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const userId = url.searchParams.get('userId');
    const resourceId = url.searchParams.get('resourceId');
    const isDocente = sessionUser.role === 'DOCENTE';
    const isEncargado = sessionUser.role === 'ENCARGADO';

    const scopedResources = db.resources.filter((item) => {
      if (isEncargado && item.area !== sessionUser.area) return false;
      return true;
    });

    const scopedResourceIds = new Set(scopedResources.map((item) => Number(item.id)));

    let loans = db.loans.filter((item) => {
      if (isDocente && Number(item.requesterId) !== Number(sessionUser.id)) return false;
      if (isEncargado && !scopedResourceIds.has(Number(item.resourceId))) return false;
      if (userId && Number(item.requesterId) !== Number(userId)) return false;
      if (resourceId && Number(item.resourceId) !== Number(resourceId)) return false;
      return true;
    });

    let reservations = db.reservations.filter((item) => {
      if (isDocente && Number(item.requesterId) !== Number(sessionUser.id)) return false;
      if (isEncargado && !scopedResourceIds.has(Number(item.resourceId))) return false;
      if (userId && Number(item.requesterId) !== Number(userId)) return false;
      if (resourceId && Number(item.resourceId) !== Number(resourceId)) return false;
      return true;
    });

    let internalRequests = db.internalRequests.filter((item) => {
      if (isDocente && Number(item.requesterId) !== Number(sessionUser.id)) return false;
      if (userId && Number(item.requesterId) !== Number(userId)) return false;
      return true;
    });

    let printRequests = db.printRequests.filter((item) => {
      if (isDocente && Number(item.requesterId) !== Number(sessionUser.id)) return false;
      if (userId && Number(item.requesterId) !== Number(userId)) return false;
      return true;
    });

    loans = applyCreatedAtRange(loans, from, to);
    reservations = applyCreatedAtRange(reservations, from, to);
    internalRequests = applyCreatedAtRange(internalRequests, from, to);
    printRequests = applyCreatedAtRange(printRequests, from, to);

    const topMap = loans.reduce((acc, item) => {
      const key = Number(item.resourceId);
      acc[key] = (acc[key] || 0) + Number(item.quantity || 0);
      return acc;
    }, {});

    const topResources = Object.entries(topMap)
      .map(([resourceIdRaw, totalQuantity]) => {
        const found = resourceById(db, Number(resourceIdRaw));
        return {
          resourceId: String(resourceIdRaw),
          resourceName: found?.name || 'Recurso',
          resourceCode: found?.code || '-',
          totalQuantity
        };
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    return {
      period: { from: from || null, to: to || null },
      totals: {
        resources: scopedResources.length,
        loans: loans.length,
        activeLoans: loans.filter((item) => ['ACTIVE', 'OVERDUE'].includes(item.status)).length,
        reservations: reservations.length,
        pendingReservations: reservations.filter((item) => item.status === 'PENDING').length,
        internalRequests: internalRequests.length,
        pendingInternalRequests: internalRequests.filter((item) => ['PENDING', 'IN_PROGRESS'].includes(item.status)).length,
        printRequests: printRequests.length,
        pendingPrintRequests: printRequests.filter((item) => item.status === 'PENDING').length,
        totalPrintedPages: printRequests.reduce((acc, item) => acc + Number(item.pages) * Number(item.copies), 0)
      },
      topResources
    };
  };

  const staticRequest = async (path, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const auth = options.auth !== false;
    const body = options.body || {};
    const responseType = options.responseType || 'json';

    const url = splitPath(path);
    const pathname = url.pathname;

    let db = loadDb();
    const sessionUser = auth ? ensureAuthUser() : null;

    const send = (payload) => clone(payload);
    const fail = (message) => {
      throw new Error(message);
    };

    if (method === 'POST' && pathname === '/auth/login') {
      const email = normalize(body.email);
      const password = String(body.password || '');
      const found = db.users.find((item) => normalize(item.email) === email);
      if (!found) fail('Credenciales invalidas');
      if (found.status !== 'ACTIVE') fail('Cuenta desactivada');
      if (String(found.password) !== password) fail('Credenciales invalidas');

      const role = roleById(db, found.roleId);
      const loginUser = {
        id: String(found.id),
        _id: String(found.id),
        name: found.name,
        email: found.email,
        role: role?.name || 'DOCENTE',
        area: found.area
      };

      addAudit(db, loginUser, 'INICIO_SESION', 'AUTENTICACION', found.id, { message: 'Usuario autenticado' });
      saveDb(db);

      return send({
        success: true,
        token: `${TOKEN_PREFIX}${Date.now()}-${found.id}`,
        user: loginUser
      });
    }

    if (method === 'GET' && pathname === '/auth/me') {
      return send({ success: true, user: sessionUser });
    }

    if (method === 'GET' && pathname === '/users/roles') {
      return send({ success: true, data: db.roles.filter((item) => item.status === 'ACTIVE').map(toRole) });
    }

    if (method === 'GET' && pathname === '/users/operational') {
      let rows = db.users.filter((item) => item.status === 'ACTIVE');
      const roleFilter = normalize(url.searchParams.get('role'));
      if (roleFilter) {
        rows = rows.filter((item) => normalize(roleById(db, item.roleId)?.name) === roleFilter);
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return send({ success: true, data: rows.map((item) => toUser(db, item)) });
    }

    if (method === 'GET' && pathname === '/users') {
      let rows = [...db.users];
      const roleFilter = normalize(url.searchParams.get('role'));
      const statusFilter = normalize(url.searchParams.get('status'));
      const q = normalize(url.searchParams.get('q'));
      if (roleFilter) rows = rows.filter((item) => normalize(roleById(db, item.roleId)?.name) === roleFilter);
      if (statusFilter) rows = rows.filter((item) => normalize(item.status) === statusFilter);
      if (q) {
        rows = rows.filter((item) => [item.name, item.email, item.area].some((value) => normalize(value).includes(q)));
      }
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toUser(db, item)), meta: buildMeta(total, page, limit) });
    }

    if (method === 'POST' && pathname === '/users') {
      const required = ['name', 'email', 'password', 'roleId'].filter((key) => !body[key]);
      if (required.length) fail(`Campos requeridos: ${required.join(', ')}`);

      const roleId = Number(body.roleId);
      const role = roleById(db, roleId);
      if (!role || role.status !== 'ACTIVE') fail('Rol invalido');

      const email = normalize(body.email);
      if (db.users.some((item) => normalize(item.email) === email)) fail('Ya existe un usuario con ese correo');

      const user = {
        id: db.nextIds.users++,
        name: String(body.name).trim(),
        email: String(body.email).trim().toLowerCase(),
        password: String(body.password),
        roleId,
        area: String(body.area || 'General').trim(),
        phone: String(body.phone || '').trim(),
        status: String(body.status || 'ACTIVE').toUpperCase(),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.users.push(user);
      addAudit(db, sessionUser, 'CREAR_USUARIO', 'USUARIOS', user.id, { email: user.email, role: role.name });
      saveDb(db);
      return send({ success: true, data: toUser(db, user) });
    }

    const userPutMatch = pathname.match(/^\/users\/(\d+)$/);
    if (method === 'PUT' && userPutMatch) {
      const id = Number(userPutMatch[1]);
      const user = userById(db, id);
      if (!user) fail('Usuario no encontrado');

      if (body.roleId !== undefined) {
        const role = roleById(db, Number(body.roleId));
        if (!role) fail('Rol no encontrado');
        user.roleId = Number(body.roleId);
      }

      if (body.email !== undefined) {
        const newEmail = normalize(body.email);
        const exists = db.users.some((item) => Number(item.id) !== id && normalize(item.email) === newEmail);
        if (exists) fail('Ya existe un usuario con ese correo');
        user.email = String(body.email).trim().toLowerCase();
      }

      if (body.password !== undefined && String(body.password).trim()) user.password = String(body.password);
      if (body.name !== undefined) user.name = String(body.name).trim();
      if (body.area !== undefined) user.area = String(body.area).trim();
      if (body.phone !== undefined) user.phone = String(body.phone).trim();
      user.updatedAt = nowIso();

      addAudit(db, sessionUser, 'ACTUALIZAR_USUARIO', 'USUARIOS', user.id, { fields: Object.keys(body) });
      saveDb(db);
      return send({ success: true, data: toUser(db, user) });
    }

    const userStatusMatch = pathname.match(/^\/users\/(\d+)\/status$/);
    if (method === 'PATCH' && userStatusMatch) {
      const id = Number(userStatusMatch[1]);
      const user = userById(db, id);
      if (!user) fail('Usuario no encontrado');
      const status = String(body.status || '').toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(status)) fail('status debe ser ACTIVE o INACTIVE');
      user.status = status;
      user.updatedAt = nowIso();
      addAudit(db, sessionUser, 'ACTUALIZAR_ESTADO_USUARIO', 'USUARIOS', user.id, { status });
      saveDb(db);
      return send({ success: true, data: toUser(db, user) });
    }

    if (method === 'GET' && pathname === '/resources/categories') {
      let rows = [...db.categories];
      const status = normalize(url.searchParams.get('status'));
      if (status) rows = rows.filter((item) => normalize(item.status) === status);
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return send({ success: true, data: rows.map(toCategory) });
    }

    if (method === 'POST' && pathname === '/resources/categories') {
      if (!body.name || !String(body.name).trim()) fail('Nombre de categoria requerido');
      const exists = db.categories.some((item) => normalize(item.name) === normalize(body.name));
      if (exists) fail('Ya existe una categoria con ese nombre');

      const category = {
        id: db.nextIds.categories++,
        name: String(body.name).trim(),
        description: String(body.description || '').trim(),
        status: String(body.status || 'ACTIVE').toUpperCase(),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.categories.push(category);
      addAudit(db, sessionUser, 'CREAR_CATEGORIA', 'RECURSOS', category.id, { name: category.name });
      saveDb(db);
      return send({ success: true, data: toCategory(category) });
    }

    const categoryPutMatch = pathname.match(/^\/resources\/categories\/(\d+)$/);
    if (method === 'PUT' && categoryPutMatch) {
      const id = Number(categoryPutMatch[1]);
      const category = categoryById(db, id);
      if (!category) fail('Categoria no encontrada');

      if (body.name !== undefined) {
        const exists = db.categories.some((item) => Number(item.id) !== id && normalize(item.name) === normalize(body.name));
        if (exists) fail('Ya existe una categoria con ese nombre');
        category.name = String(body.name).trim();
      }
      if (body.description !== undefined) category.description = String(body.description).trim();
      if (body.status !== undefined) category.status = String(body.status).toUpperCase();
      category.updatedAt = nowIso();

      addAudit(db, sessionUser, 'ACTUALIZAR_CATEGORIA', 'RECURSOS', category.id, { fields: Object.keys(body) });
      saveDb(db);
      return send({ success: true, data: toCategory(category) });
    }

    if (method === 'GET' && pathname === '/resources') {
      let rows = [...db.resources];
      const status = normalize(url.searchParams.get('status'));
      const area = normalize(url.searchParams.get('area'));
      const categoryId = Number(url.searchParams.get('categoryId') || 0);
      const q = normalize(url.searchParams.get('q'));

      if (sessionUser.role === 'ENCARGADO') {
        rows = rows.filter((item) => item.area === sessionUser.area);
      }

      if (status) rows = rows.filter((item) => normalize(item.status) === status);
      if (area) rows = rows.filter((item) => normalize(item.area) === area);
      if (categoryId) rows = rows.filter((item) => Number(item.categoryId) === categoryId);
      if (q) rows = rows.filter((item) => [item.code, item.name, item.location].some((value) => normalize(value).includes(q)));

      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toResource(db, item)), meta: buildMeta(total, page, limit) });
    }

    if (method === 'POST' && pathname === '/resources') {
      const required = ['code', 'name', 'categoryId', 'totalQuantity', 'area'].filter((key) => body[key] === undefined || body[key] === null || body[key] === '');
      if (required.length) fail(`Campos requeridos: ${required.join(', ')}`);

      const categoryIdRaw = Number(body.categoryId);
      const category = categoryById(db, categoryIdRaw);
      if (!category || category.status !== 'ACTIVE') fail('Categoria invalida');
      if (db.resources.some((item) => normalize(item.code) === normalize(body.code))) fail('Ya existe un recurso con ese codigo');
      if (sessionUser.role === 'ENCARGADO' && sessionUser.area !== String(body.area).trim()) fail('Solo puedes crear recursos de tu area');

      const totalQuantity = Number(body.totalQuantity);
      const availableQuantity = body.availableQuantity !== undefined ? Number(body.availableQuantity) : totalQuantity;

      const resource = {
        id: db.nextIds.resources++,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        categoryId: categoryIdRaw,
        description: String(body.description || '').trim(),
        area: String(body.area).trim(),
        location: String(body.location || '').trim(),
        unit: String(body.unit || 'unidad').trim(),
        totalQuantity,
        availableQuantity: Math.min(Math.max(availableQuantity, 0), totalQuantity),
        minStock: Number(body.minStock || 0),
        price: Number(body.price || 0),
        status: String(body.status || 'ACTIVE').toUpperCase(),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      db.resources.push(resource);
      addAudit(db, sessionUser, 'CREAR_RECURSO', 'RECURSOS', resource.id, { code: resource.code, area: resource.area });
      saveDb(db);
      return send({ success: true, data: toResource(db, resource) });
    }

    const resourceMatch = pathname.match(/^\/resources\/(\d+)$/);
    if (resourceMatch && method === 'PUT') {
      const id = Number(resourceMatch[1]);
      const resource = resourceById(db, id);
      if (!resource) fail('Recurso no encontrado');
      if (sessionUser.role === 'ENCARGADO' && resource.area !== sessionUser.area) fail('Solo puedes editar recursos de tu area');

      if (body.categoryId !== undefined) {
        const category = categoryById(db, Number(body.categoryId));
        if (!category) fail('Categoria no encontrada');
        resource.categoryId = Number(body.categoryId);
      }
      if (body.code !== undefined) {
        const duplicated = db.resources.some((item) => Number(item.id) !== id && normalize(item.code) === normalize(body.code));
        if (duplicated) fail('Ya existe un recurso con ese codigo');
        resource.code = String(body.code).trim();
      }
      if (body.name !== undefined) resource.name = String(body.name).trim();
      if (body.description !== undefined) resource.description = String(body.description).trim();
      if (body.area !== undefined) {
        if (sessionUser.role === 'ENCARGADO' && sessionUser.area !== String(body.area).trim()) fail('No puedes mover recursos a otra area');
        resource.area = String(body.area).trim();
      }
      if (body.location !== undefined) resource.location = String(body.location).trim();
      if (body.unit !== undefined) resource.unit = String(body.unit).trim();
      if (body.totalQuantity !== undefined) resource.totalQuantity = Number(body.totalQuantity);
      if (body.availableQuantity !== undefined) resource.availableQuantity = Number(body.availableQuantity);
      if (body.minStock !== undefined) resource.minStock = Number(body.minStock);
      if (body.price !== undefined) resource.price = Number(body.price);
      if (body.status !== undefined) resource.status = String(body.status).toUpperCase();

      if (resource.availableQuantity > resource.totalQuantity) resource.availableQuantity = resource.totalQuantity;
      if (resource.availableQuantity < 0) resource.availableQuantity = 0;
      resource.updatedAt = nowIso();

      addAudit(db, sessionUser, 'ACTUALIZAR_RECURSO', 'RECURSOS', resource.id, { fields: Object.keys(body) });
      saveDb(db);
      return send({ success: true, data: toResource(db, resource) });
    }

    if (resourceMatch && method === 'DELETE') {
      const id = Number(resourceMatch[1]);
      const resource = resourceById(db, id);
      if (!resource) fail('Recurso no encontrado');
      if (sessionUser.role === 'ENCARGADO' && resource.area !== sessionUser.area) fail('Solo puedes desactivar recursos de tu area');
      resource.status = 'INACTIVE';
      resource.updatedAt = nowIso();
      addAudit(db, sessionUser, 'DESACTIVAR_RECURSO', 'RECURSOS', resource.id, { mode: 'soft-delete' });
      saveDb(db);
      return send({ success: true, message: 'Recurso desactivado' });
    }

    if (method === 'GET' && pathname === '/loans') {
      let rows = [...db.loans];
      const status = normalize(url.searchParams.get('status'));
      const requesterId = Number(url.searchParams.get('requesterId') || 0);
      const resourceId = Number(url.searchParams.get('resourceId') || 0);
      if (sessionUser.role === 'ENCARGADO') {
        rows = rows.filter((item) => resourceById(db, item.resourceId)?.area === sessionUser.area);
      }
      if (status) rows = rows.filter((item) => normalize(item.status) === status);
      if (requesterId) rows = rows.filter((item) => Number(item.requesterId) === requesterId);
      if (resourceId) rows = rows.filter((item) => Number(item.resourceId) === resourceId);
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toLoan(db, item)), meta: buildMeta(total, page, limit) });
    }

    if (method === 'POST' && pathname === '/loans') {
      if (!body.resourceId || !body.quantity || !body.dueDate) fail('resourceId, quantity y dueDate son requeridos');
      const requesterId = Number(body.requesterId || sessionUser.id);
      const resourceId = Number(body.resourceId);
      const quantity = Number(body.quantity);
      const dueDate = parseMaybeDate(body.dueDate);
      const requester = userById(db, requesterId);
      const resource = resourceById(db, resourceId);
      if (!requester || requester.status !== 'ACTIVE') fail('Solicitante no valido');
      if (!resource || resource.status !== 'ACTIVE') fail('Recurso no valido');
      if (!dueDate) fail('dueDate invalido');
      if (!Number.isFinite(quantity) || quantity <= 0) fail('La cantidad debe ser mayor a 0');
      if (Number(resource.availableQuantity) < quantity) fail('Stock insuficiente para el prestamo');

      resource.availableQuantity -= quantity;
      resource.updatedAt = nowIso();

      const loan = {
        id: db.nextIds.loans++,
        requesterId,
        resourceId,
        quantity,
        startDate: todayIsoDate(),
        dueDate: dueDate.toISOString(),
        returnedDate: null,
        comments: String(body.comments || '').trim(),
        approvedBy: Number(sessionUser.id),
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.loans.push(loan);
      addAudit(db, sessionUser, 'CREAR_PRESTAMO', 'PRESTAMOS', loan.id, { requester: requester.email, resource: resource.code, quantity });
      saveDb(db);
      return send({ success: true, data: toLoan(db, loan) });
    }

    const loanEditMatch = pathname.match(/^\/loans\/(\d+)$/);
    if (method === 'PATCH' && loanEditMatch) {
      const id = Number(loanEditMatch[1]);
      const loan = db.loans.find((item) => Number(item.id) === id);
      if (!loan) fail('Prestamo no encontrado');
      if (!['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.status)) fail('Solo prestamos activos, vencidos o pendientes pueden editarse');
      const resource = resourceById(db, loan.resourceId);
      if (!resource) fail('Recurso asociado no encontrado');

      if (body.quantity !== undefined) {
        const newQuantity = Number(body.quantity);
        if (!Number.isFinite(newQuantity) || newQuantity <= 0) fail('quantity invalida');
        const delta = newQuantity - Number(loan.quantity);
        if (delta > 0 && Number(resource.availableQuantity) < delta) fail('Stock insuficiente para aumentar la cantidad del prestamo');
        resource.availableQuantity -= delta;
        if (resource.availableQuantity > resource.totalQuantity) resource.availableQuantity = resource.totalQuantity;
        if (resource.availableQuantity < 0) resource.availableQuantity = 0;
        loan.quantity = newQuantity;
      }
      if (body.dueDate !== undefined) {
        const dueDate = parseMaybeDate(body.dueDate);
        if (!dueDate) fail('dueDate invalido');
        loan.dueDate = dueDate.toISOString();
      }
      if (body.comments !== undefined) loan.comments = String(body.comments || '').trim();

      resource.updatedAt = nowIso();
      loan.updatedAt = nowIso();
      addAudit(db, sessionUser, 'ACTUALIZAR_PRESTAMO', 'PRESTAMOS', loan.id, { fields: Object.keys(body) });
      saveDb(db);
      return send({ success: true, data: toLoan(db, loan) });
    }

    const loanDeactivateMatch = pathname.match(/^\/loans\/(\d+)\/deactivate$/);
    if (method === 'PATCH' && loanDeactivateMatch) {
      const id = Number(loanDeactivateMatch[1]);
      const loan = db.loans.find((item) => Number(item.id) === id);
      if (!loan) fail('Prestamo no encontrado');
      if (!['ACTIVE', 'OVERDUE', 'PENDING'].includes(loan.status)) fail('Solo prestamos activos, vencidos o pendientes pueden desactivarse');
      const resource = resourceById(db, loan.resourceId);
      if (resource) {
        resource.availableQuantity = Math.min(Number(resource.totalQuantity), Number(resource.availableQuantity) + Number(loan.quantity));
        resource.updatedAt = nowIso();
      }
      loan.status = 'CANCELLED';
      if (body.comments !== undefined) loan.comments = String(body.comments || '').trim();
      loan.updatedAt = nowIso();
      addAudit(db, sessionUser, 'DESACTIVAR_PRESTAMO', 'PRESTAMOS', loan.id, { status: 'CANCELLED' });
      saveDb(db);
      return send({ success: true, data: toLoan(db, loan) });
    }

    const loanReturnMatch = pathname.match(/^\/loans\/(\d+)\/return$/);
    if (method === 'PATCH' && loanReturnMatch) {
      const id = Number(loanReturnMatch[1]);
      const loan = db.loans.find((item) => Number(item.id) === id);
      if (!loan) fail('Prestamo no encontrado');
      if (!['ACTIVE', 'OVERDUE'].includes(loan.status)) fail('Solo prestamos activos o vencidos pueden cerrarse');
      const resource = resourceById(db, loan.resourceId);
      if (resource) {
        resource.availableQuantity = Math.min(Number(resource.totalQuantity), Number(resource.availableQuantity) + Number(loan.quantity));
        resource.updatedAt = nowIso();
      }
      loan.status = 'RETURNED';
      loan.returnedDate = nowIso();
      loan.updatedAt = nowIso();
      addAudit(db, sessionUser, 'DEVOLVER_PRESTAMO', 'PRESTAMOS', loan.id, { returnedDate: loan.returnedDate });
      saveDb(db);
      return send({ success: true, data: toLoan(db, loan) });
    }

    if (method === 'GET' && pathname === '/reservations') {
      let rows = [...db.reservations];
      const status = normalize(url.searchParams.get('status'));
      if (sessionUser.role === 'ENCARGADO' && normalize(sessionUser.area) !== 'biblioteca') {
        rows = rows.filter((item) => resourceById(db, item.resourceId)?.area === sessionUser.area);
      }
      if (status) rows = rows.filter((item) => normalize(item.status) === status);
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toReservation(db, item)), meta: buildMeta(total, page, limit) });
    }

    if (method === 'POST' && pathname === '/reservations') {
      if (!body.resourceId || !body.purpose || !body.startDate || !body.endDate) fail('resourceId, purpose, startDate y endDate son requeridos');
      const resource = resourceById(db, Number(body.resourceId));
      if (!resource || resource.status !== 'ACTIVE') fail('Recurso no valido');
      const startDate = parseMaybeDate(body.startDate);
      const endDate = parseMaybeDate(body.endDate);
      if (!startDate || !endDate || endDate <= startDate) fail('Rango de fechas invalido');

      const requesterId = sessionUser.role === 'DOCENTE' ? Number(sessionUser.id) : Number(body.requesterId || sessionUser.id);
      const requester = userById(db, requesterId);
      if (!requester || requester.status !== 'ACTIVE') fail('Solicitante no valido');

      const reservation = {
        id: db.nextIds.reservations++,
        requesterId,
        resourceId: Number(body.resourceId),
        purpose: String(body.purpose).trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reviewedBy: null,
        reviewComments: '',
        status: 'PENDING',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.reservations.push(reservation);
      addAudit(db, sessionUser, 'CREAR_RESERVA', 'RESERVAS', reservation.id, { resource: resource.code, period: `${body.startDate} - ${body.endDate}` });
      saveDb(db);
      return send({ success: true, data: toReservation(db, reservation) });
    }

    const reservationReviewMatch = pathname.match(/^\/reservations\/(\d+)\/review$/);
    if (method === 'PATCH' && reservationReviewMatch) {
      const id = Number(reservationReviewMatch[1]);
      const reservation = db.reservations.find((item) => Number(item.id) === id);
      if (!reservation) fail('Reserva no encontrada');
      if (reservation.status !== 'PENDING') fail('Solo reservas pendientes pueden revisarse');
      const status = String(body.status || '').toUpperCase();
      if (!['APPROVED', 'REJECTED'].includes(status)) fail('status debe ser APPROVED o REJECTED');

      if (status === 'APPROVED') {
        const conflict = db.reservations.find((item) => {
          if (Number(item.id) === id) return false;
          if (Number(item.resourceId) !== Number(reservation.resourceId)) return false;
          if (item.status !== 'APPROVED') return false;
          return new Date(item.startDate) < new Date(reservation.endDate) && new Date(item.endDate) > new Date(reservation.startDate);
        });
        if (conflict) fail('Existe una reserva aprobada en ese rango horario');
      }

      reservation.status = status;
      reservation.reviewComments = String(body.reviewComments || '').trim();
      reservation.reviewedBy = Number(sessionUser.id);
      reservation.updatedAt = nowIso();
      addAudit(db, sessionUser, 'REVISAR_RESERVA', 'RESERVAS', reservation.id, { status });
      saveDb(db);
      return send({ success: true, data: toReservation(db, reservation) });
    }

    const reservationCancelMatch = pathname.match(/^\/reservations\/(\d+)\/cancel$/);
    if (method === 'PATCH' && reservationCancelMatch) {
      const id = Number(reservationCancelMatch[1]);
      const reservation = db.reservations.find((item) => Number(item.id) === id);
      if (!reservation) fail('Reserva no encontrada');
      if (!['PENDING', 'APPROVED'].includes(reservation.status)) fail('La reserva no puede cancelarse en su estado actual');
      reservation.status = 'CANCELLED';
      reservation.reviewComments = String(body.reason || reservation.reviewComments || '').trim();
      if (!reservation.reviewedBy) reservation.reviewedBy = Number(sessionUser.id);
      reservation.updatedAt = nowIso();
      addAudit(db, sessionUser, 'CANCELAR_RESERVA', 'RESERVAS', reservation.id, { by: sessionUser.role });
      saveDb(db);
      return send({ success: true, data: toReservation(db, reservation) });
    }

    if (method === 'GET' && pathname === '/requests') {
      let rows = [...db.internalRequests];
      const status = normalize(url.searchParams.get('status'));
      if (sessionUser.role === 'DOCENTE') rows = rows.filter((item) => Number(item.requesterId) === Number(sessionUser.id));
      if (status) rows = rows.filter((item) => normalize(item.status) === status);
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toInternalRequest(db, item)), meta: buildMeta(total, page, limit) });
    }

    if (method === 'POST' && pathname === '/requests') {
      if (!body.title || !body.description) fail('title y description son requeridos');
      const item = {
        id: db.nextIds.internalRequests++,
        requesterId: Number(sessionUser.id),
        title: String(body.title).trim(),
        description: String(body.description).trim(),
        priority: String(body.priority || 'MEDIUM').toUpperCase(),
        reviewedBy: null,
        reviewComments: '',
        status: 'PENDING',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.internalRequests.push(item);
      addAudit(db, sessionUser, 'CREAR_SOLICITUD_INTERNA', 'SOLICITUDES', item.id, { priority: item.priority });
      saveDb(db);
      return send({ success: true, data: toInternalRequest(db, item) });
    }

    const requestReviewMatch = pathname.match(/^\/requests\/(\d+)\/review$/);
    if (method === 'PATCH' && requestReviewMatch) {
      const id = Number(requestReviewMatch[1]);
      const item = db.internalRequests.find((row) => Number(row.id) === id);
      if (!item) fail('Solicitud no encontrada');
      if (item.status !== 'PENDING') fail('Solo solicitudes pendientes pueden aprobarse o rechazarse');
      const status = String(body.status || '').toUpperCase();
      if (!['APPROVED', 'REJECTED'].includes(status)) fail('Estado invalido para revision. Solo se permite APPROVED o REJECTED');
      item.status = status;
      item.reviewedBy = Number(sessionUser.id);
      item.reviewComments = String(body.reviewComments || '').trim();
      item.updatedAt = nowIso();
      addAudit(db, sessionUser, 'REVISAR_SOLICITUD_INTERNA', 'SOLICITUDES', item.id, { status });
      saveDb(db);
      return send({ success: true, data: toInternalRequest(db, item) });
    }

    if (method === 'GET' && pathname === '/prints') {
      let rows = [...db.printRequests];
      const status = normalize(url.searchParams.get('status'));
      if (sessionUser.role === 'DOCENTE') rows = rows.filter((item) => Number(item.requesterId) === Number(sessionUser.id));
      if (status) rows = rows.filter((item) => normalize(item.status) === status);
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toPrintRequest(db, item)), meta: buildMeta(total, page, limit) });
    }

    if (method === 'POST' && pathname === '/prints') {
      if (!body.documentName || !body.pages || !body.copies) fail('documentName, pages y copies son requeridos');
      const pages = Number(body.pages);
      const copies = Number(body.copies);
      if (pages <= 0 || copies <= 0) fail('pages y copies deben ser mayores que 0');

      const item = {
        id: db.nextIds.printRequests++,
        requesterId: Number(sessionUser.id),
        documentName: String(body.documentName).trim(),
        pages,
        copies,
        color: Boolean(body.color),
        doubleSided: Boolean(body.doubleSided),
        reviewedBy: null,
        reviewComments: '',
        status: 'PENDING',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.printRequests.push(item);
      addAudit(db, sessionUser, 'CREAR_SOLICITUD_IMPRESION', 'IMPRESIONES', item.id, { pages, copies });
      saveDb(db);
      return send({ success: true, data: toPrintRequest(db, item) });
    }

    const printReviewMatch = pathname.match(/^\/prints\/(\d+)\/review$/);
    if (method === 'PATCH' && printReviewMatch) {
      const id = Number(printReviewMatch[1]);
      const item = db.printRequests.find((row) => Number(row.id) === id);
      if (!item) fail('Solicitud de impresion no encontrada');
      if (item.status !== 'PENDING') fail('Solo solicitudes pendientes pueden revisarse');
      const status = String(body.status || '').toUpperCase();
      if (!['APPROVED', 'REJECTED', 'DONE'].includes(status)) fail('Estado invalido para revision');
      item.status = status;
      item.reviewedBy = Number(sessionUser.id);
      item.reviewComments = String(body.reviewComments || '').trim();
      item.updatedAt = nowIso();
      addAudit(db, sessionUser, 'REVISAR_SOLICITUD_IMPRESION', 'IMPRESIONES', item.id, { status });
      saveDb(db);
      return send({ success: true, data: toPrintRequest(db, item) });
    }

    if (method === 'GET' && pathname === '/dashboard') {
      return send({ success: true, data: buildDashboardData(db, sessionUser) });
    }

    if (method === 'GET' && pathname === '/reports/summary') {
      return send({ success: true, data: buildSummaryData(db, sessionUser, url) });
    }

    if (method === 'GET' && pathname === '/reports/export') {
      const summary = buildSummaryData(db, sessionUser, url);
      const lines = [
        'Sistema Web de Gestion Escolar',
        'Reporte general (modo estatico)',
        '',
        `Generado por: ${sessionUser.name} (${sessionUser.role})`,
        `Fecha: ${new Date().toLocaleString()}`,
        `Rango: ${summary.period.from || 'sin inicio'} - ${summary.period.to || 'sin termino'}`,
        '',
        'Totales:',
        ...Object.entries(summary.totals).map(([k, v]) => `${k}: ${v}`),
        '',
        'Top recursos por prestamos:',
        ...summary.topResources.map((item, index) => `${index + 1}. ${item.resourceName} (${item.resourceCode}) - ${item.totalQuantity}`)
      ];
      const content = lines.join('\n');
      const blob = new Blob([content], { type: 'application/pdf' });
      if (responseType === 'blob') return blob;
      return send({ success: true, data: content });
    }

    if (method === 'GET' && pathname === '/audit-logs') {
      let rows = [...db.auditLogs];
      const moduleFilter = normalize(url.searchParams.get('module'));
      const actionFilter = normalize(url.searchParams.get('action'));
      const userEmailFilter = normalize(url.searchParams.get('userEmail'));
      const statusFilter = normalize(url.searchParams.get('status'));
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      if (moduleFilter) rows = rows.filter((item) => normalize(item.module) === moduleFilter);
      if (actionFilter) rows = rows.filter((item) => normalize(item.action).includes(actionFilter));
      if (userEmailFilter) rows = rows.filter((item) => normalize(item.userEmail).includes(userEmailFilter));
      if (statusFilter) rows = rows.filter((item) => normalize(item.status) === statusFilter);
      rows = applyCreatedAtRange(rows, from, to);
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const { page, limit, skip } = parsePagination(url);
      const total = rows.length;
      return send({ success: true, data: rows.slice(skip, skip + limit).map((item) => toAuditLog(db, item)), meta: buildMeta(total, page, limit) });
    }

    fail(`Ruta no implementada en modo estatico: ${method} ${pathname}`);
  };

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

    if (app.config.apiMode === 'static') {
      try {
        return await staticRequest(path, { method, body, headers, auth, responseType });
      } catch (error) {
        if (String(error.message || '').toLowerCase().includes('sesion expirada') && auth) {
          app.auth.clearSession();
          app.auth.redirect('login.html');
        }
        throw error;
      }
    }

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
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    resetStaticData: () => {
      localStorage.removeItem(STORAGE_KEY);
    },
    getStaticData: () => clone(loadDb()),
    getRolePermissions: (roleName) => STATIC_PERMISSIONS[String(roleName || '').toUpperCase()] || []
  };
})();

