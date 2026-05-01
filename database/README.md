# Capa de Base de Datos (SQL Server)

Esta carpeta contiene la definicion de datos para SQL Server.

## Script principal
- `sqlserver/init.sql`
  - Crea la base `sistema_escolar` si no existe.
  - Crea tablas en espanol, relaciones y restricciones.
  - Inserta datos iniciales (roles, permisos, admin, categorias y recursos demo).
  - Crea sinonimos en ingles para mantener compatibilidad con el backend.

## Ejecucion
Puedes ejecutar `database/sqlserver/init.sql` desde SSMS o con ADO.NET/PowerShell.

## Usuario administrador inicial
- Correo: `admin@admin.com`
- Password: `123456`

## Nota tecnica
El backend ya incorpora conexion SQL Server en `backend/src/config/db.js` con `DB_PROVIDER=sqlserver`.
