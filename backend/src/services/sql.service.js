const sql = require('mssql');
const ApiError = require('../utils/ApiError');
const { getSqlPool } = require('../config/db');

const getExecutor = (transaccion) => {
  if (transaccion) return transaccion;

  const pool = getSqlPool();
  if (!pool) {
    throw new ApiError(503, 'Base de datos no disponible temporalmente');
  }

  return pool;
};

const bindInputs = (request, params = {}) => {
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });
};

const query = async (text, params = {}, transaccion = null) => {
  const executor = getExecutor(transaccion);
  const request = executor.request();
  bindInputs(request, params);
  const result = await request.query(text);
  return result.recordset || [];
};

const one = async (text, params = {}, transaccion = null) => {
  const rows = await query(text, params, transaccion);
  return rows[0] || null;
};

const scalar = async (text, params = {}, transaccion = null) => {
  const row = await one(text, params, transaccion);
  if (!row) return null;
  const firstKey = Object.keys(row)[0];
  return row[firstKey];
};

const withTransaction = async (callback) => {
  const pool = getSqlPool();
  if (!pool) {
    throw new ApiError(503, 'Base de datos no disponible temporalmente');
  }

  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();

  try {
    const value = await callback(transaccion);
    await transaccion.commit();
    return value;
  } catch (error) {
    await transaccion.rollback();
    throw error;
  }
};

module.exports = {
  query,
  one,
  scalar,
  withTransaction
};





