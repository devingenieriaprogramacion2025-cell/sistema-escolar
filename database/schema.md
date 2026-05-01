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
- `usuarios.role_id -> roles.id`
- `permisos_rol.role_id -> roles.id`
- `recursos.category_id -> categorias.id`
- `prestamos.requester_id -> usuarios.id`
- `prestamos.resource_id -> recursos.id`
- `prestamos.approved_by -> usuarios.id`
- `reservas.requester_id -> usuarios.id`
- `reservas.resource_id -> recursos.id`
- `reservas.reviewed_by -> usuarios.id`
- `solicitudes_internas.requester_id -> usuarios.id`
- `solicitudes_internas.reviewed_by -> usuarios.id`
- `solicitudes_impresion.requester_id -> usuarios.id`
- `solicitudes_impresion.reviewed_by -> usuarios.id`
- `bitacora_auditoria.user_id -> usuarios.id`

## Restricciones
- Estados (`status`) con `CHECK` por tabla.
- Cantidades y stock con validaciones (`quantity > 0`, `available_quantity <= total_quantity`).
- Correos y codigos unicos (`users.email`, `resources.code`).

## Inicializacion
- Script completo: `database/sqlserver/init.sql`
- Crea DB, tablas y datos demo.
- Incluye sinonimos de compatibilidad en ingles para el backend actual (`users`, `resources`, `loans`, etc.).
