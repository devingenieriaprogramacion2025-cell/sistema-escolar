const sql = require('mssql');
const { getSqlPool } = require('../config/db');

const getExecutor = (transaction) => {
  if (transaction) return transaction;

  const pool = getSqlPool();
  if (!pool) {
    throw new Error('El pool de SQL Server no esta inicializado');
  }

  return pool;
};

const bindInputs = (request, params = {}) => {
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });
};

const query = async (text, params = {}, transaction = null) => {
  const executor = getExecutor(transaction);
  const request = executor.request();
  bindInputs(request, params);
  const result = await request.query(text);
  return result.recordset || [];
};

const one = async (text, params = {}, transaction = null) => {
  const rows = await query(text, params, transaction);
  return rows[0] || null;
};

const scalar = async (text, params = {}, transaction = null) => {
  const row = await one(text, params, transaction);
  if (!row) return null;
  const firstKey = Object.keys(row)[0];
  return row[firstKey];
};

const withTransaction = async (callback) => {
  const pool = getSqlPool();
  if (!pool) {
    throw new Error('El pool de SQL Server no esta inicializado');
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const value = await callback(transaction);
    await transaction.commit();
    return value;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  query,
  one,
  scalar,
  withTransaction
};
