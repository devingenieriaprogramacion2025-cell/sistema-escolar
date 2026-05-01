const mongoose = require('mongoose');
const sql = require('mssql');

let sqlPool = null;

const getProvider = () => (process.env.DB_PROVIDER || 'sqlserver').trim().toLowerCase();

const parseSqlServerTarget = () => {
  const rawTarget = (
    process.env.SQLSERVER_SERVER ||
    process.env.DB_SERVER ||
    'localhost'
  ).trim();

  if (!rawTarget.includes('\\')) {
    return {
      server: rawTarget,
      instanceName: process.env.SQLSERVER_INSTANCE || process.env.DB_INSTANCE || undefined
    };
  }

  const [server, instanceName] = rawTarget.split('\\');
  return { server, instanceName };
};

const connectMongo = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || undefined
  });
  console.log('MongoDB conectado');
};

const connectSqlServer = async () => {
  const { server, instanceName } = parseSqlServerTarget();

  const config = {
    user: process.env.SQLSERVER_USER || process.env.DB_USER,
    password: process.env.SQLSERVER_PASSWORD || process.env.DB_PASSWORD,
    server,
    database: process.env.SQLSERVER_DATABASE || process.env.DB_NAME || 'sistema_escolar',
    options: {
      encrypt: (process.env.SQLSERVER_ENCRYPT || 'true').toLowerCase() !== 'false',
      trustServerCertificate:
        (process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false'
    },
    pool: {
      max: Number(process.env.SQLSERVER_POOL_MAX || 10),
      min: Number(process.env.SQLSERVER_POOL_MIN || 0),
      idleTimeoutMillis: Number(process.env.SQLSERVER_POOL_IDLE_MS || 30000)
    }
  };

  if (instanceName) {
    config.options.instanceName = instanceName;
  }

  if (process.env.SQLSERVER_PORT) {
    config.port = Number(process.env.SQLSERVER_PORT);
  }

  sqlPool = await sql.connect(config);
  await sqlPool.request().query('SELECT 1 AS ok');
  console.log('SQL Server conectado');
};

const connectDB = async () => {
  try {
    const provider = getProvider();

    if (provider === 'mongodb') {
      await connectMongo();
      return;
    }

    await connectSqlServer();
  } catch (error) {
    console.error('Error de conexion a la base de datos:', error.message);
    process.exit(1);
  }
};

const getSqlPool = () => sqlPool;

module.exports = connectDB;
module.exports.getSqlPool = getSqlPool;
