const sql = require('mssql');

let sqlPool = null;
let isConnecting = false;
let reconnectTimer = null;
let lastConnectionError = null;

const RETRY_INTERVAL_MS = Number(process.env.SQLSERVER_RETRY_MS || 10000);

const shouldExitOnConnectionFailure = () => {
  const raw =
    process.env.DB_EXIT_ON_FAILURE ||
    process.env.SQLSERVER_EXIT_ON_FAILURE ||
    'false';

  return String(raw).toLowerCase() === 'true';
};

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

const connectSqlServer = async () => {
  if (sqlPool) return sqlPool;
  if (isConnecting) return null;

  isConnecting = true;
  const { server, instanceName } = parseSqlServerTarget();

  try {
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
    lastConnectionError = null;
    console.log('SQL Server conectado');
    return sqlPool;
  } catch (error) {
    lastConnectionError = error;
    throw error;
  } finally {
    isConnecting = false;
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;

  reconnectTimer = setInterval(async () => {
    if (sqlPool || isConnecting) return;

    try {
      await connectSqlServer();
      console.log('Conexion con SQL Server restablecida');
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    } catch (error) {
      console.warn(`Reintento SQL Server fallido: ${error.message}`);
    }
  }, RETRY_INTERVAL_MS);
};

const connectDB = async () => {
  try {
    await connectSqlServer();
  } catch (error) {
    console.error('Error de conexion a la base de datos:', error.message);

    if (shouldExitOnConnectionFailure()) {
      process.exit(1);
    }

    console.warn(
      `Iniciando servidor sin base de datos. Reintentando conexion cada ${RETRY_INTERVAL_MS}ms.`
    );
    scheduleReconnect();
  }
};

const getSqlPool = () => sqlPool;

const getDbStatus = () => ({
  connected: Boolean(sqlPool),
  isConnecting,
  lastError: lastConnectionError ? lastConnectionError.message : null
});

module.exports = connectDB;
module.exports.getSqlPool = getSqlPool;
module.exports.getDbStatus = getDbStatus;





