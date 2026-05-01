SET NOCOUNT ON;
GO

IF DB_ID(N'sistema_escolar') IS NULL
BEGIN
  CREATE DATABASE [sistema_escolar];
END
GO

USE [sistema_escolar];
GO

IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'role_permissions' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.role_permissions;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'audit_logs' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.audit_logs;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'print_requests' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.print_requests;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'internal_requests' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.internal_requests;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'reservations' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.reservations;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'loans' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.loans;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'resources' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.resources;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'categories' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.categories;
IF EXISTS (SELECT 1 FROM sys.synonyms WHERE name = N'users' AND schema_id = SCHEMA_ID(N'dbo')) DROP SYNONYM dbo.users;
GO

IF OBJECT_ID(N'dbo.permisos_rol', N'U') IS NOT NULL DROP TABLE dbo.permisos_rol;
IF OBJECT_ID(N'dbo.bitacora_auditoria', N'U') IS NOT NULL DROP TABLE dbo.bitacora_auditoria;
IF OBJECT_ID(N'dbo.solicitudes_impresion', N'U') IS NOT NULL DROP TABLE dbo.solicitudes_impresion;
IF OBJECT_ID(N'dbo.solicitudes_internas', N'U') IS NOT NULL DROP TABLE dbo.solicitudes_internas;
IF OBJECT_ID(N'dbo.reservas', N'U') IS NOT NULL DROP TABLE dbo.reservas;
IF OBJECT_ID(N'dbo.prestamos', N'U') IS NOT NULL DROP TABLE dbo.prestamos;
IF OBJECT_ID(N'dbo.recursos', N'U') IS NOT NULL DROP TABLE dbo.recursos;
IF OBJECT_ID(N'dbo.categorias', N'U') IS NOT NULL DROP TABLE dbo.categorias;
IF OBJECT_ID(N'dbo.usuarios', N'U') IS NOT NULL DROP TABLE dbo.usuarios;
IF OBJECT_ID(N'dbo.role_permissions', N'U') IS NOT NULL DROP TABLE dbo.role_permissions;
IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NOT NULL DROP TABLE dbo.audit_logs;
IF OBJECT_ID(N'dbo.print_requests', N'U') IS NOT NULL DROP TABLE dbo.print_requests;
IF OBJECT_ID(N'dbo.internal_requests', N'U') IS NOT NULL DROP TABLE dbo.internal_requests;
IF OBJECT_ID(N'dbo.reservations', N'U') IS NOT NULL DROP TABLE dbo.reservations;
IF OBJECT_ID(N'dbo.loans', N'U') IS NOT NULL DROP TABLE dbo.loans;
IF OBJECT_ID(N'dbo.resources', N'U') IS NOT NULL DROP TABLE dbo.resources;
IF OBJECT_ID(N'dbo.categories', N'U') IS NOT NULL DROP TABLE dbo.categories;
IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL DROP TABLE dbo.users;
IF OBJECT_ID(N'dbo.roles', N'U') IS NOT NULL DROP TABLE dbo.roles;
GO

CREATE TABLE dbo.roles (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(50) NOT NULL UNIQUE,
  [description] NVARCHAR(255) NOT NULL DEFAULT N'',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_roles_status CHECK ([status] IN (N'ACTIVE', N'INACTIVE'))
);
GO

CREATE TABLE dbo.role_permissions (
  role_id INT NOT NULL,
  permission NVARCHAR(100) NOT NULL,
  CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission),
  CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  [name] NVARCHAR(120) NOT NULL,
  email NVARCHAR(150) NOT NULL UNIQUE,
  [password] NVARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  area NVARCHAR(120) NOT NULL DEFAULT N'General',
  phone NVARCHAR(30) NOT NULL DEFAULT N'',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_users_status CHECK ([status] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT FK_users_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id)
);
GO

CREATE TABLE dbo.categories (
  id INT IDENTITY(1,1) PRIMARY KEY,
  [name] NVARCHAR(100) NOT NULL UNIQUE,
  [description] NVARCHAR(255) NOT NULL DEFAULT N'',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_categories_status CHECK ([status] IN (N'ACTIVE', N'INACTIVE'))
);
GO

CREATE TABLE dbo.resources (
  id INT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) NOT NULL UNIQUE,
  [name] NVARCHAR(150) NOT NULL,
  category_id INT NOT NULL,
  [description] NVARCHAR(500) NOT NULL DEFAULT N'',
  area NVARCHAR(120) NOT NULL DEFAULT N'General',
  [location] NVARCHAR(120) NOT NULL DEFAULT N'',
  unit_name NVARCHAR(50) NOT NULL DEFAULT N'unidad',
  total_quantity INT NOT NULL,
  available_quantity INT NOT NULL,
  min_stock INT NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  [status] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_resources_status CHECK ([status] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT CK_resources_totals CHECK (total_quantity >= 0 AND available_quantity >= 0 AND available_quantity <= total_quantity),
  CONSTRAINT CK_resources_min_stock CHECK (min_stock >= 0),
  CONSTRAINT CK_resources_price CHECK (price >= 0),
  CONSTRAINT FK_resources_category FOREIGN KEY (category_id) REFERENCES dbo.categories(id)
);
GO

CREATE TABLE dbo.loans (
  id INT IDENTITY(1,1) PRIMARY KEY,
  requester_id INT NOT NULL,
  resource_id INT NOT NULL,
  quantity INT NOT NULL,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  returned_date DATE NULL,
  comments NVARCHAR(500) NOT NULL DEFAULT N'',
  approved_by INT NULL,
  [status] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_loans_status CHECK ([status] IN (N'PENDING', N'ACTIVE', N'RETURNED', N'OVERDUE', N'CANCELLED')),
  CONSTRAINT CK_loans_quantity CHECK (quantity > 0),
  CONSTRAINT FK_loans_requester FOREIGN KEY (requester_id) REFERENCES dbo.users(id),
  CONSTRAINT FK_loans_resource FOREIGN KEY (resource_id) REFERENCES dbo.resources(id),
  CONSTRAINT FK_loans_approved_by FOREIGN KEY (approved_by) REFERENCES dbo.users(id)
);
GO

CREATE TABLE dbo.reservations (
  id INT IDENTITY(1,1) PRIMARY KEY,
  requester_id INT NOT NULL,
  resource_id INT NOT NULL,
  purpose NVARCHAR(500) NOT NULL,
  start_date DATETIME2(0) NOT NULL,
  end_date DATETIME2(0) NOT NULL,
  reviewed_by INT NULL,
  review_comments NVARCHAR(500) NOT NULL DEFAULT N'',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_reservations_status CHECK ([status] IN (N'PENDING', N'APPROVED', N'REJECTED', N'CANCELLED')),
  CONSTRAINT FK_reservations_requester FOREIGN KEY (requester_id) REFERENCES dbo.users(id),
  CONSTRAINT FK_reservations_resource FOREIGN KEY (resource_id) REFERENCES dbo.resources(id),
  CONSTRAINT FK_reservations_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES dbo.users(id)
);
GO

CREATE TABLE dbo.internal_requests (
  id INT IDENTITY(1,1) PRIMARY KEY,
  requester_id INT NOT NULL,
  title NVARCHAR(200) NOT NULL,
  [description] NVARCHAR(1000) NOT NULL,
  priority NVARCHAR(20) NOT NULL DEFAULT N'MEDIUM',
  reviewed_by INT NULL,
  review_comments NVARCHAR(500) NOT NULL DEFAULT N'',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_internal_requests_priority CHECK (priority IN (N'LOW', N'MEDIUM', N'HIGH', N'URGENT')),
  CONSTRAINT CK_internal_requests_status CHECK ([status] IN (N'PENDING', N'IN_PROGRESS', N'APPROVED', N'REJECTED', N'DONE')),
  CONSTRAINT FK_internal_requests_requester FOREIGN KEY (requester_id) REFERENCES dbo.users(id),
  CONSTRAINT FK_internal_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES dbo.users(id)
);
GO

CREATE TABLE dbo.print_requests (
  id INT IDENTITY(1,1) PRIMARY KEY,
  requester_id INT NOT NULL,
  document_name NVARCHAR(200) NOT NULL,
  pages INT NOT NULL,
  copies INT NOT NULL DEFAULT 1,
  color BIT NOT NULL DEFAULT 0,
  double_sided BIT NOT NULL DEFAULT 0,
  reviewed_by INT NULL,
  review_comments NVARCHAR(500) NOT NULL DEFAULT N'',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_print_requests_status CHECK ([status] IN (N'PENDING', N'APPROVED', N'REJECTED', N'DONE')),
  CONSTRAINT CK_print_requests_pages CHECK (pages > 0),
  CONSTRAINT CK_print_requests_copies CHECK (copies > 0),
  CONSTRAINT FK_print_requests_requester FOREIGN KEY (requester_id) REFERENCES dbo.users(id),
  CONSTRAINT FK_print_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES dbo.users(id)
);
GO

CREATE TABLE dbo.audit_logs (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NULL,
  user_email NVARCHAR(150) NOT NULL DEFAULT N'system',
  role NVARCHAR(50) NOT NULL DEFAULT N'SYSTEM',
  [action] NVARCHAR(100) NOT NULL,
  [module] NVARCHAR(100) NOT NULL,
  entity_id NVARCHAR(50) NULL,
  details NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
  [status] NVARCHAR(20) NOT NULL DEFAULT N'SUCCESS',
  created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_audit_logs_status CHECK ([status] IN (N'SUCCESS', N'FAILED')),
  CONSTRAINT FK_audit_logs_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);
GO

EXEC sp_rename 'dbo.role_permissions', 'permisos_rol';
EXEC sp_rename 'dbo.users', 'usuarios';
EXEC sp_rename 'dbo.categories', 'categorias';
EXEC sp_rename 'dbo.resources', 'recursos';
EXEC sp_rename 'dbo.loans', 'prestamos';
EXEC sp_rename 'dbo.reservations', 'reservas';
EXEC sp_rename 'dbo.internal_requests', 'solicitudes_internas';
EXEC sp_rename 'dbo.print_requests', 'solicitudes_impresion';
EXEC sp_rename 'dbo.audit_logs', 'bitacora_auditoria';
GO

CREATE SYNONYM dbo.role_permissions FOR dbo.permisos_rol;
CREATE SYNONYM dbo.users FOR dbo.usuarios;
CREATE SYNONYM dbo.categories FOR dbo.categorias;
CREATE SYNONYM dbo.resources FOR dbo.recursos;
CREATE SYNONYM dbo.loans FOR dbo.prestamos;
CREATE SYNONYM dbo.reservations FOR dbo.reservas;
CREATE SYNONYM dbo.internal_requests FOR dbo.solicitudes_internas;
CREATE SYNONYM dbo.print_requests FOR dbo.solicitudes_impresion;
CREATE SYNONYM dbo.audit_logs FOR dbo.bitacora_auditoria;
GO

INSERT INTO dbo.roles ([name], [description], [status])
VALUES
  (N'ADMIN', N'Rol ADMIN', N'ACTIVE'),
  (N'DIRECTIVO', N'Rol DIRECTIVO', N'ACTIVE'),
  (N'INSPECTORIA', N'Rol INSPECTORIA', N'ACTIVE'),
  (N'DOCENTE', N'Rol DOCENTE', N'ACTIVE'),
  (N'ENCARGADO', N'Rol ENCARGADO', N'ACTIVE');
GO

INSERT INTO dbo.role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM (VALUES
  (N'ADMIN', N'*'),
  (N'DIRECTIVO', N'DASHBOARD:READ'),
  (N'DIRECTIVO', N'REPORTS:READ'),
  (N'DIRECTIVO', N'REPORTS:EXPORT'),
  (N'DIRECTIVO', N'RESOURCES:READ'),
  (N'DIRECTIVO', N'LOANS:READ'),
  (N'DIRECTIVO', N'REQUESTS:READ'),
  (N'DIRECTIVO', N'REQUESTS:REVIEW'),
  (N'DIRECTIVO', N'PRINTS:READ'),
  (N'DIRECTIVO', N'PRINTS:CREATE'),
  (N'INSPECTORIA', N'DASHBOARD:READ'),
  (N'INSPECTORIA', N'RESOURCES:READ'),
  (N'INSPECTORIA', N'RESOURCES:WRITE'),
  (N'INSPECTORIA', N'LOANS:READ'),
  (N'INSPECTORIA', N'LOANS:WRITE'),
  (N'INSPECTORIA', N'RESERVATIONS:READ'),
  (N'INSPECTORIA', N'RESERVATIONS:WRITE'),
  (N'INSPECTORIA', N'REQUESTS:READ'),
  (N'INSPECTORIA', N'REQUESTS:WRITE'),
  (N'INSPECTORIA', N'PRINTS:READ'),
  (N'INSPECTORIA', N'PRINTS:WRITE'),
  (N'INSPECTORIA', N'AUDIT:READ'),
  (N'DOCENTE', N'DASHBOARD:READ'),
  (N'DOCENTE', N'RESOURCES:READ'),
  (N'DOCENTE', N'LOANS:READ_OWN'),
  (N'DOCENTE', N'RESERVATIONS:READ_OWN'),
  (N'DOCENTE', N'RESERVATIONS:CREATE'),
  (N'DOCENTE', N'REQUESTS:READ_OWN'),
  (N'DOCENTE', N'REQUESTS:CREATE'),
  (N'DOCENTE', N'PRINTS:READ_OWN'),
  (N'DOCENTE', N'PRINTS:CREATE'),
  (N'ENCARGADO', N'DASHBOARD:READ'),
  (N'ENCARGADO', N'RESOURCES:READ'),
  (N'ENCARGADO', N'RESOURCES:WRITE_AREA'),
  (N'ENCARGADO', N'LOANS:READ'),
  (N'ENCARGADO', N'RESERVATIONS:READ'),
  (N'ENCARGADO', N'PRINTS:READ'),
  (N'ENCARGADO', N'PRINTS:CREATE'),
  (N'ENCARGADO', N'PRINTS:REVIEW')
) p(role_name, permission)
INNER JOIN dbo.roles r ON r.name = p.role_name;
GO

INSERT INTO dbo.users ([name], email, [password], role_id, area, phone, [status])
SELECT
  v.[name],
  v.email,
  N'$2b$10$Q5BvSLADKI5Q2sfXn7f17OnlY32LTnWwky7QJ.9G8nm4EZvTTZ23.',
  r.id,
  v.area,
  N'',
  N'ACTIVE'
FROM (VALUES
  (N'ADMIN', N'Administrador General', N'admin@admin.com', N'Administracion'),
  (N'DIRECTIVO', N'Director Academico', N'directivo@colegio.com', N'Direccion'),
  (N'INSPECTORIA', N'Inspector General', N'inspectoria@colegio.com', N'Convivencia'),
  (N'DOCENTE', N'Docente Demo', N'docente@colegio.com', N'Matematicas'),
  (N'ENCARGADO', N'Encargado Biblioteca', N'encargado@colegio.com', N'Biblioteca'),
  (N'DOCENTE', N'1 Basico', N'1basico@colegio.com', N'1 Basico'),
  (N'DOCENTE', N'2 Basico', N'2basico@colegio.com', N'2 Basico'),
  (N'DOCENTE', N'3 Basico', N'3basico@colegio.com', N'3 Basico'),
  (N'DOCENTE', N'4 Basico', N'4basico@colegio.com', N'4 Basico'),
  (N'DOCENTE', N'5 Basico', N'5basico@colegio.com', N'5 Basico'),
  (N'DOCENTE', N'6 Basico', N'6basico@colegio.com', N'6 Basico'),
  (N'DOCENTE', N'7 Basico', N'7basico@colegio.com', N'7 Basico'),
  (N'DOCENTE', N'8 Basico', N'8basico@colegio.com', N'8 Basico'),
  (N'DOCENTE', N'Profesores', N'profesores@colegio.com', N'Profesores'),
  (N'DOCENTE', N'Administrativos', N'administrativos@colegio.com', N'Administrativos')
) v(role_name, [name], email, area)
INNER JOIN dbo.roles r ON r.name = v.role_name;
GO

INSERT INTO dbo.categories ([name], [description], [status])
VALUES
  (N'Tecnologia', N'Computadores y equipos audiovisuales', N'ACTIVE'),
  (N'Laboratorio', N'Materiales de laboratorio', N'ACTIVE'),
  (N'Biblioteca', N'Material bibliografico', N'ACTIVE'),
  (N'Oficina', N'Insumos de oficina e impresion', N'ACTIVE');
GO

INSERT INTO dbo.resources (code, [name], category_id, [description], area, [location], unit_name, total_quantity, available_quantity, min_stock, price, [status])
SELECT v.code, v.[name], c.id, v.[description], v.area, v.[location], v.unit_name, v.total_quantity, v.available_quantity, v.min_stock, v.price, v.[status]
FROM (VALUES
  (N'REC-001', N'Proyector Epson', N'Tecnologia', N'Proyector multimedia para sala de clases', N'Tecnologia', N'Bodega T1', N'unidad', 8, 6, 2, 450000.00, N'ACTIVE'),
  (N'REC-002', N'Notebook Dell', N'Tecnologia', N'Equipo de apoyo para docentes', N'Tecnologia', N'Bodega T2', N'unidad', 20, 14, 4, 620000.00, N'ACTIVE'),
  (N'REC-003', N'Kit de Laboratorio Quimica', N'Laboratorio', N'Set de tubos, reactivos y soporte', N'Laboratorio', N'Lab 1', N'kit', 15, 10, 5, 90000.00, N'ACTIVE'),
  (N'REC-004', N'Resma Carta', N'Oficina', N'Papel para impresiones internas', N'Administracion', N'Archivo Central', N'resma', 60, 24, 20, 4500.00, N'ACTIVE'),
  (N'REC-005', N'Set Libros Lectura Complementaria', N'Biblioteca', N'Coleccion para prestamo docente', N'Biblioteca', N'Estante B4', N'set', 35, 31, 8, 25000.00, N'ACTIVE')
) v(code, [name], category_name, [description], area, [location], unit_name, total_quantity, available_quantity, min_stock, price, [status])
INNER JOIN dbo.categories c ON c.name = v.category_name;
GO
