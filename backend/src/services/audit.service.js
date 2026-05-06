const { query } = require('./sql.service');

const audit = async ({ req, accion, modulo, entityId = null, detalles = {}, estado = 'SUCCESS' }) => {
  try {
    await query(
      `
      INSERT INTO dbo.bitacora_auditoria
      (usuario_id, correo_usuario, rol, accion, modulo, entidad_id, detalles, estado, creado_en, actualizado_en)
      VALUES
      (@userId, @userEmail, @rol, @accion, @modulo, @entityId, @detalles, @estado, SYSUTCDATETIME(), SYSUTCDATETIME());
      `,
      {
        userId: req?.user?.id ? Number(req.user.id) : null,
        userEmail: req?.user?.email || 'system',
        rol: req?.user?.role || 'SYSTEM',
        accion,
        modulo,
        entityId: entityId ? String(entityId) : null,
        detalles: JSON.stringify(detalles || {}),
        estado
      }
    );
  } catch (error) {
    console.error('Audit error:', error.message);
  }
};

module.exports = {
  audit
};





