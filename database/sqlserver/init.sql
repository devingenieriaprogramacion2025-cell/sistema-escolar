SET NOCOUNT ON;
GO

IF DB_ID(N'sistema_escolar') IS NULL
BEGIN
  CREATE DATABASE [sistema_escolar];
END
GO

USE [sistema_escolar];
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
IF OBJECT_ID(N'dbo.roles', N'U') IS NOT NULL DROP TABLE dbo.roles;
GO

CREATE TABLE dbo.roles (
  id INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(50) NOT NULL UNIQUE,
  [descripcion] NVARCHAR(255) NOT NULL DEFAULT N'',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_roles_estado CHECK ([estado] IN (N'ACTIVE', N'INACTIVE'))
);
GO

CREATE TABLE dbo.permisos_rol (
  rol_id INT NOT NULL,
  permiso NVARCHAR(100) NOT NULL,
  CONSTRAINT PK_role_permisos PRIMARY KEY (rol_id, permiso),
  CONSTRAINT FK_role_permisos_rol FOREIGN KEY (rol_id) REFERENCES dbo.roles(id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.usuarios (
  id INT IDENTITY(1,1) PRIMARY KEY,
  [nombre] NVARCHAR(120) NOT NULL,
  email NVARCHAR(150) NOT NULL UNIQUE,
  [contrasena] NVARCHAR(255) NOT NULL,
  rol_id INT NOT NULL,
  area NVARCHAR(120) NOT NULL DEFAULT N'General',
  telefono NVARCHAR(30) NOT NULL DEFAULT N'',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_users_estado CHECK ([estado] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT FK_users_rol FOREIGN KEY (rol_id) REFERENCES dbo.roles(id)
);
GO

CREATE TABLE dbo.categorias (
  id INT IDENTITY(1,1) PRIMARY KEY,
  [nombre] NVARCHAR(100) NOT NULL UNIQUE,
  [descripcion] NVARCHAR(255) NOT NULL DEFAULT N'',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_categories_estado CHECK ([estado] IN (N'ACTIVE', N'INACTIVE'))
);
GO

CREATE TABLE dbo.recursos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  codigo NVARCHAR(50) NOT NULL UNIQUE,
  [nombre] NVARCHAR(150) NOT NULL,
  categoria_id INT NOT NULL,
  [descripcion] NVARCHAR(500) NOT NULL DEFAULT N'',
  area NVARCHAR(120) NOT NULL DEFAULT N'General',
  [ubicacion] NVARCHAR(120) NOT NULL DEFAULT N'',
  nombre_unidad NVARCHAR(50) NOT NULL DEFAULT N'unidad',
  cantidad_total INT NOT NULL,
  cantidad_disponible INT NOT NULL,
  stock_minimo INT NOT NULL DEFAULT 0,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_resources_estado CHECK ([estado] IN (N'ACTIVE', N'INACTIVE')),
  CONSTRAINT CK_resources_totals CHECK (cantidad_total >= 0 AND cantidad_disponible >= 0 AND cantidad_disponible <= cantidad_total),
  CONSTRAINT CK_resources_stock_minimo CHECK (stock_minimo >= 0),
  CONSTRAINT CK_resources_precio CHECK (precio >= 0),
  CONSTRAINT FK_resources_category FOREIGN KEY (categoria_id) REFERENCES dbo.categorias(id)
);
GO

CREATE TABLE dbo.prestamos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  solicitante_id INT NOT NULL,
  recurso_id INT NOT NULL,
  cantidad INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  fecha_devolucion DATE NULL,
  comentarios NVARCHAR(500) NOT NULL DEFAULT N'',
  aprobado_por INT NULL,
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_loans_estado CHECK ([estado] IN (N'PENDING', N'ACTIVE', N'RETURNED', N'OVERDUE', N'CANCELLED')),
  CONSTRAINT CK_loans_cantidad CHECK (cantidad > 0),
  CONSTRAINT FK_loans_requester FOREIGN KEY (solicitante_id) REFERENCES dbo.usuarios(id),
  CONSTRAINT FK_loans_resource FOREIGN KEY (recurso_id) REFERENCES dbo.recursos(id),
  CONSTRAINT FK_loans_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES dbo.usuarios(id)
);
GO

CREATE TABLE dbo.reservas (
  id INT IDENTITY(1,1) PRIMARY KEY,
  solicitante_id INT NOT NULL,
  recurso_id INT NOT NULL,
  proposito NVARCHAR(500) NOT NULL,
  fecha_inicio DATETIME2(0) NOT NULL,
  fecha_fin DATETIME2(0) NOT NULL,
  revisado_por INT NULL,
  comentarios_revision NVARCHAR(500) NOT NULL DEFAULT N'',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_reservations_estado CHECK ([estado] IN (N'PENDING', N'APPROVED', N'REJECTED', N'CANCELLED')),
  CONSTRAINT FK_reservations_requester FOREIGN KEY (solicitante_id) REFERENCES dbo.usuarios(id),
  CONSTRAINT FK_reservations_resource FOREIGN KEY (recurso_id) REFERENCES dbo.recursos(id),
  CONSTRAINT FK_reservations_revisado_por FOREIGN KEY (revisado_por) REFERENCES dbo.usuarios(id)
);
GO

CREATE TABLE dbo.solicitudes_internas (
  id INT IDENTITY(1,1) PRIMARY KEY,
  solicitante_id INT NOT NULL,
  titulo NVARCHAR(200) NOT NULL,
  [descripcion] NVARCHAR(1000) NOT NULL,
  prioridad NVARCHAR(20) NOT NULL DEFAULT N'MEDIUM',
  revisado_por INT NULL,
  comentarios_revision NVARCHAR(500) NOT NULL DEFAULT N'',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_internal_requests_prioridad CHECK (prioridad IN (N'LOW', N'MEDIUM', N'HIGH', N'URGENT')),
  CONSTRAINT CK_internal_requests_estado CHECK ([estado] IN (N'PENDING', N'IN_PROGRESS', N'APPROVED', N'REJECTED', N'DONE')),
  CONSTRAINT FK_internal_requests_requester FOREIGN KEY (solicitante_id) REFERENCES dbo.usuarios(id),
  CONSTRAINT FK_internal_requests_revisado_por FOREIGN KEY (revisado_por) REFERENCES dbo.usuarios(id)
);
GO

CREATE TABLE dbo.solicitudes_impresion (
  id INT IDENTITY(1,1) PRIMARY KEY,
  solicitante_id INT NOT NULL,
  nombre_documento NVARCHAR(200) NOT NULL,
  paginas INT NOT NULL,
  copias INT NOT NULL DEFAULT 1,
  es_color BIT NOT NULL DEFAULT 0,
  doble_cara BIT NOT NULL DEFAULT 0,
  revisado_por INT NULL,
  comentarios_revision NVARCHAR(500) NOT NULL DEFAULT N'',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_print_requests_estado CHECK ([estado] IN (N'PENDING', N'APPROVED', N'REJECTED', N'DONE')),
  CONSTRAINT CK_print_requests_paginas CHECK (paginas > 0),
  CONSTRAINT CK_print_requests_copias CHECK (copias > 0),
  CONSTRAINT FK_print_requests_requester FOREIGN KEY (solicitante_id) REFERENCES dbo.usuarios(id),
  CONSTRAINT FK_print_requests_revisado_por FOREIGN KEY (revisado_por) REFERENCES dbo.usuarios(id)
);
GO

CREATE TABLE dbo.bitacora_auditoria (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NULL,
  correo_usuario NVARCHAR(150) NOT NULL DEFAULT N'system',
  rol NVARCHAR(50) NOT NULL DEFAULT N'SYSTEM',
  [accion] NVARCHAR(100) NOT NULL,
  [modulo] NVARCHAR(100) NOT NULL,
  entidad_id NVARCHAR(50) NULL,
  detalles NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
  [estado] NVARCHAR(20) NOT NULL DEFAULT N'SUCCESS',
  creado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  actualizado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_audit_logs_estado CHECK ([estado] IN (N'SUCCESS', N'FAILED')),
  CONSTRAINT FK_audit_logs_user FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id)
);
GO

INSERT INTO dbo.roles ([nombre], [descripcion], [estado])
VALUES
  (N'ADMIN', N'Rol ADMIN', N'ACTIVE'),
  (N'DIRECTIVO', N'Rol DIRECTIVO', N'ACTIVE'),
  (N'INSPECTORIA', N'Rol INSPECTORIA', N'ACTIVE'),
  (N'DOCENTE', N'Rol DOCENTE', N'ACTIVE'),
  (N'ENCARGADO', N'Rol ENCARGADO', N'ACTIVE');
GO

INSERT INTO dbo.permisos_rol (rol_id, permiso)
SELECT r.id, p.permiso
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
) p(rol_nombre, permiso)
INNER JOIN dbo.roles r ON r.nombre = p.rol_nombre;
GO

INSERT INTO dbo.usuarios ([nombre], email, [contrasena], rol_id, area, telefono, [estado])
SELECT
  v.[nombre],
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
) v(rol_nombre, [nombre], email, area)
INNER JOIN dbo.roles r ON r.nombre = v.rol_nombre;
GO

INSERT INTO dbo.categorias ([nombre], [descripcion], [estado])
VALUES
  (N'Tecnologia', N'Computadores y equipos audiovisuales', N'ACTIVE'),
  (N'Laboratorio', N'Materiales de laboratorio', N'ACTIVE'),
  (N'Biblioteca', N'Material bibliografico', N'ACTIVE'),
  (N'Oficina', N'Insumos de oficina e impresion', N'ACTIVE');
GO

INSERT INTO dbo.recursos (codigo, [nombre], categoria_id, [descripcion], area, [ubicacion], nombre_unidad, cantidad_total, cantidad_disponible, stock_minimo, precio, [estado])
SELECT v.codigo, v.[nombre], c.id, v.[descripcion], v.area, v.[ubicacion], v.nombre_unidad, v.cantidad_total, v.cantidad_disponible, v.stock_minimo, v.precio, v.[estado]
FROM (VALUES
  (N'REC-001', N'Proyector Epson', N'Tecnologia', N'Proyector multimedia para sala de clases', N'Tecnologia', N'Bodega T1', N'unidad', 8, 6, 2, 450000.00, N'ACTIVE'),
  (N'REC-002', N'Notebook Dell', N'Tecnologia', N'Equipo de apoyo para docentes', N'Tecnologia', N'Bodega T2', N'unidad', 20, 14, 4, 620000.00, N'ACTIVE'),
  (N'REC-003', N'Kit de Laboratorio Quimica', N'Laboratorio', N'Set de tubos, reactivos y soporte', N'Laboratorio', N'Lab 1', N'kit', 15, 10, 5, 90000.00, N'ACTIVE'),
  (N'REC-004', N'Resma Carta', N'Oficina', N'Papel para impresiones internas', N'Administracion', N'Archivo Central', N'resma', 60, 24, 20, 4500.00, N'ACTIVE'),
  (N'REC-005', N'Set Libros Lectura Complementaria', N'Biblioteca', N'Coleccion para prestamo docente', N'Biblioteca', N'Estante B4', N'set', 35, 31, 8, 25000.00, N'ACTIVE')
) v(codigo, [nombre], categoria_nombre, [descripcion], area, [ubicacion], nombre_unidad, cantidad_total, cantidad_disponible, stock_minimo, precio, [estado])
INNER JOIN dbo.categorias c ON c.nombre = v.categoria_nombre;
GO



