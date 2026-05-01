const { query } = require('./sql.service');

const audit = async ({ req, action, module, entityId = null, details = {}, status = 'SUCCESS' }) => {
  try {
    await query(
      `
      INSERT INTO dbo.audit_logs
      (user_id, user_email, role, action, module, entity_id, details, status, created_at, updated_at)
      VALUES
      (@userId, @userEmail, @role, @action, @module, @entityId, @details, @status, SYSUTCDATETIME(), SYSUTCDATETIME());
      `,
      {
        userId: req?.user?.id ? Number(req.user.id) : null,
        userEmail: req?.user?.email || 'system',
        role: req?.user?.role || 'SYSTEM',
        action,
        module,
        entityId: entityId ? String(entityId) : null,
        details: JSON.stringify(details || {}),
        status
      }
    );
  } catch (error) {
    console.error('Audit error:', error.message);
  }
};

module.exports = {
  audit
};
