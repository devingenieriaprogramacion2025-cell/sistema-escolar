# Esquema SQL Server (sistema_escolar)

## Tablas principales (nombres en espanol)
- `roles`
- `permisos_rol`
- `usuarios`
- `categorias`
- `recursos`
- `prestamos`
- `reservas`
- `solicitudes_internas`
- `solicitudes_impresion`
- `bitacora_auditoria`

## Relaciones
- `usuarios.rol_id -> roles.id`
- `permisos_rol.rol_id -> roles.id`
- `recursos.categoria_id -> categorias.id`
- `prestamos.solicitante_id -> usuarios.id`
- `prestamos.recurso_id -> recursos.id`
- `prestamos.aprobado_por -> usuarios.id`
- `reservas.solicitante_id -> usuarios.id`
- `reservas.recurso_id -> recursos.id`
- `reservas.revisado_por -> usuarios.id`
- `solicitudes_internas.solicitante_id -> usuarios.id`
- `solicitudes_internas.revisado_por -> usuarios.id`
- `solicitudes_impresion.solicitante_id -> usuarios.id`
- `solicitudes_impresion.revisado_por -> usuarios.id`
- `bitacora_auditoria.usuario_id -> usuarios.id`

## Restricciones
- Estados (`estado`) con `CHECK` por tabla.
- Cantidades y stock con validaciones (`cantidad > 0`, `cantidad_disponible <= cantidad_total`).
- Correos y codigos unicos (`usuarios.email`, `recursos.codigo`).

## Inicializacion
- Script completo: `database/sqlserver/init.sql`
- Crea DB, tablas y datos demo.
- No incluye sinonimos ni tablas espejo en ingles.

