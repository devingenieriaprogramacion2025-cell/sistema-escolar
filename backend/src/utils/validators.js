const isValidObjectId = (value) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim();
  return /^[1-9]\d*$/.test(normalized);
};

const requireFields = (body, fields) => {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  return {
    valid: missing.length === 0,
    missing
  };
};

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildDateRange = (from, to, fieldName = 'createdAt') => {
  if (!from && !to) return {};

  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) {
      range.$gte = start;
    }
  }

  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }

  if (Object.keys(range).length === 0) return {};
  return { [fieldName]: range };
};

module.exports = {
  isValidObjectId,
  requireFields,
  parsePagination,
  buildDateRange
};
