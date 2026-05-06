const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const sql = require('mssql');

const parseSqlServerTarget = () => {
  const rawTarget = (process.env.SQLSERVER_SERVER || process.env.DB_SERVER || 'localhost').trim();
  if (!rawTarget.includes('\\')) {
    return {
      server: rawTarget,
      instanceName: process.env.SQLSERVER_INSTANCE || process.env.DB_INSTANCE || undefined
    };
  }

  const [server, instanceName] = rawTarget.split('\\');
  return { server, instanceName };
};

const splitSqlBatches = (script) => script.split(/^\s*GO\s*$/gim).map((x) => x.trim()).filter(Boolean);

const run = async () => {
  const { server, instanceName } = parseSqlServerTarget();

  const config = {
    user: process.env.SQLSERVER_USER || process.env.DB_USER,
    password: process.env.SQLSERVER_PASSWORD || process.env.DB_PASSWORD,
    server,
    database: 'master',
    options: {
      encrypt: (process.env.SQLSERVER_ENCRYPT || 'true').toLowerCase() !== 'false',
      trustServerCertificate:
        (process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false'
    }
  };

  if (instanceName) {
    config.options.instanceName = instanceName;
  }

  if (process.env.SQLSERVER_PORT) {
    config.port = Number(process.env.SQLSERVER_PORT);
  }

  const scriptPath = path.resolve(__dirname, '../../database/sqlserver/init.sql');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const batches = splitSqlBatches(script);

  let pool;

  try {
    pool = await sql.connect(config);
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('Inicializacion SQL Server completada');
  } catch (error) {
    console.error('Fallo la inicializacion SQL Server:', error.message);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
};

run();
