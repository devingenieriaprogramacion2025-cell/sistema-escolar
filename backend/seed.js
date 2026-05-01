require('dotenv').config();
const mongoose = require('mongoose');

const Role = require('./src/models/Role');
const User = require('./src/models/User');
const Category = require('./src/models/Category');
const Resource = require('./src/models/Resource');
const Loan = require('./src/models/Loan');
const Reservation = require('./src/models/Reservation');
const InternalRequest = require('./src/models/InternalRequest');
const PrintRequest = require('./src/models/PrintRequest');
const AuditLog = require('./src/models/AuditLog');

const { ALL_ROLES, getRolePermissions, ROLES } = require('./src/constants/roles');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME || undefined
    });

    console.log('Connected to MongoDB for seed');

    await Promise.all([
      AuditLog.deleteMany({}),
      Loan.deleteMany({}),
      Reservation.deleteMany({}),
      InternalRequest.deleteMany({}),
      PrintRequest.deleteMany({}),
      Resource.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({})
    ]);

    const roles = await Role.insertMany(
      ALL_ROLES.map((roleName) => ({
        name: roleName,
        description: `Rol ${roleName}`,
        permissions: getRolePermissions(roleName),
        status: 'ACTIVE'
      }))
    );

    const roleMap = roles.reduce((acc, role) => {
      acc[role.name] = role;
      return acc;
    }, {});

    await User.create([
      {
        name: 'Administrador General',
        email: 'admin@admin.com',
        password: '123456',
        role: roleMap[ROLES.ADMIN]._id,
        area: 'Administracion',
        status: 'ACTIVE'
      },
      {
        name: 'Director Academico',
        email: 'directivo@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DIRECTIVO]._id,
        area: 'Direccion',
        status: 'ACTIVE'
      },
      {
        name: 'Inspector General',
        email: 'inspectoria@colegio.com',
        password: '123456',
        role: roleMap[ROLES.INSPECTORIA]._id,
        area: 'Convivencia',
        status: 'ACTIVE'
      },
      {
        name: 'Docente Demo',
        email: 'docente@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: 'Matematicas',
        status: 'ACTIVE'
      },
      {
        name: 'Encargado Biblioteca',
        email: 'encargado@colegio.com',
        password: '123456',
        role: roleMap[ROLES.ENCARGADO]._id,
        area: 'Biblioteca',
        status: 'ACTIVE'
      },
      {
        name: '1 Basico',
        email: '1basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '1 Basico',
        status: 'ACTIVE'
      },
      {
        name: '2 Basico',
        email: '2basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '2 Basico',
        status: 'ACTIVE'
      },
      {
        name: '3 Basico',
        email: '3basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '3 Basico',
        status: 'ACTIVE'
      },
      {
        name: '4 Basico',
        email: '4basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '4 Basico',
        status: 'ACTIVE'
      },
      {
        name: '5 Basico',
        email: '5basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '5 Basico',
        status: 'ACTIVE'
      },
      {
        name: '6 Basico',
        email: '6basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '6 Basico',
        status: 'ACTIVE'
      },
      {
        name: '7 Basico',
        email: '7basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '7 Basico',
        status: 'ACTIVE'
      },
      {
        name: '8 Basico',
        email: '8basico@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: '8 Basico',
        status: 'ACTIVE'
      },
      {
        name: 'Profesores',
        email: 'profesores@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: 'Profesores',
        status: 'ACTIVE'
      },
      {
        name: 'Administrativos',
        email: 'administrativos@colegio.com',
        password: '123456',
        role: roleMap[ROLES.DOCENTE]._id,
        area: 'Administrativos',
        status: 'ACTIVE'
      }
    ]);

    const categoryDocs = await Category.insertMany([
      { name: 'Tecnologia', description: 'Computadores y equipos audiovisuales', status: 'ACTIVE' },
      { name: 'Laboratorio', description: 'Materiales de laboratorio', status: 'ACTIVE' },
      { name: 'Biblioteca', description: 'Material bibliografico', status: 'ACTIVE' },
      { name: 'Oficina', description: 'Insumos de oficina e impresion', status: 'ACTIVE' }
    ]);

    const categoryMap = categoryDocs.reduce((acc, item) => {
      acc[item.name] = item;
      return acc;
    }, {});

    await Resource.insertMany([
      {
        code: 'REC-001',
        name: 'Proyector Epson',
        category: categoryMap.Tecnologia._id,
        description: 'Proyector multimedia para sala de clases',
        area: 'Tecnologia',
        location: 'Bodega T1',
        unit: 'unidad',
        totalQuantity: 8,
        availableQuantity: 6,
        minStock: 2,
        price: 450000,
        status: 'ACTIVE'
      },
      {
        code: 'REC-002',
        name: 'Notebook Dell',
        category: categoryMap.Tecnologia._id,
        description: 'Equipo de apoyo para docentes',
        area: 'Tecnologia',
        location: 'Bodega T2',
        unit: 'unidad',
        totalQuantity: 20,
        availableQuantity: 14,
        minStock: 4,
        price: 620000,
        status: 'ACTIVE'
      },
      {
        code: 'REC-003',
        name: 'Kit de Laboratorio Quimica',
        category: categoryMap.Laboratorio._id,
        description: 'Set de tubos, reactivos y soporte',
        area: 'Laboratorio',
        location: 'Lab 1',
        unit: 'kit',
        totalQuantity: 15,
        availableQuantity: 10,
        minStock: 5,
        price: 90000,
        status: 'ACTIVE'
      },
      {
        code: 'REC-004',
        name: 'Resma Carta',
        category: categoryMap.Oficina._id,
        description: 'Papel para impresiones internas',
        area: 'Administracion',
        location: 'Archivo Central',
        unit: 'resma',
        totalQuantity: 60,
        availableQuantity: 24,
        minStock: 20,
        price: 4500,
        status: 'ACTIVE'
      },
      {
        code: 'REC-005',
        name: 'Set Libros Lectura Complementaria',
        category: categoryMap.Biblioteca._id,
        description: 'Coleccion para prestamo docente',
        area: 'Biblioteca',
        location: 'Estante B4',
        unit: 'set',
        totalQuantity: 35,
        availableQuantity: 31,
        minStock: 8,
        price: 25000,
        status: 'ACTIVE'
      }
    ]);

    console.log('Seed completed successfully');
    console.log('Admin credentials => admin@admin.com / 123456');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
