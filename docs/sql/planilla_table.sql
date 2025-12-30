-- Esquema recomendado para la tabla Planilla.
-- Alineado con los cálculos del backend y con los valores predeterminados esperados.

IF OBJECT_ID('dbo.Planilla', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[Planilla](
    [id_planilla] INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Planilla PRIMARY KEY,
    [id_empleado] INT NOT NULL,
    [periodo_inicio] DATE NOT NULL,
    [periodo_fin] DATE NOT NULL,
    [salario_bruto] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_SalarioBruto DEFAULT (0),
    [deducciones] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_Deducciones DEFAULT (0),
    [ccss_deduccion] DECIMAL(10, 2) NOT NULL CONSTRAINT DF_Planilla_CcssDeduccion DEFAULT (0),
    [horas_extras] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_HorasExtras DEFAULT (0),
    [bonificaciones] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_Bonificaciones DEFAULT (0),
    [pago_neto] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_PagoNeto DEFAULT (0),
    [fecha_pago] DATE NULL,
    [es_automatica] BIT NOT NULL CONSTRAINT DF_Planilla_EsAutomatica DEFAULT (1),
    [created_at] DATETIME2 NOT NULL CONSTRAINT DF_Planilla_CreatedAt DEFAULT (SYSDATETIME()),
    [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_Planilla_UpdatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Planilla_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleados(id_empleado)
  );
END;
GO

-- Ajustes mínimos si la tabla ya existe y proviene de un script anterior
-- (por ejemplo, el que no incluía es_automatica o dejaba columnas en NULL).
IF OBJECT_ID('dbo.Planilla', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Planilla', 'es_automatica') IS NULL
  BEGIN
    ALTER TABLE dbo.Planilla
      ADD es_automatica BIT NOT NULL CONSTRAINT DF_Planilla_EsAutomatica DEFAULT (1);
  END;

  ALTER TABLE dbo.Planilla
    ALTER COLUMN deducciones DECIMAL(12, 2) NOT NULL;

  ALTER TABLE dbo.Planilla
    ALTER COLUMN horas_extras DECIMAL(12, 2) NOT NULL;

  ALTER TABLE dbo.Planilla
    ALTER COLUMN bonificaciones DECIMAL(12, 2) NOT NULL;

  ALTER TABLE dbo.Planilla
    ALTER COLUMN ccss_deduccion DECIMAL(10, 2) NOT NULL;

  IF COL_LENGTH('dbo.Planilla', 'created_at') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.default_constraints
       WHERE parent_object_id = OBJECT_ID('dbo.Planilla')
         AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.Planilla'), 'created_at', 'ColumnId')
     )
  BEGIN
    ALTER TABLE dbo.Planilla ADD CONSTRAINT DF_Planilla_CreatedAt DEFAULT (SYSDATETIME()) FOR created_at;
  END;

  IF COL_LENGTH('dbo.Planilla', 'updated_at') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.default_constraints
       WHERE parent_object_id = OBJECT_ID('dbo.Planilla')
         AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('dbo.Planilla'), 'updated_at', 'ColumnId')
     )
  BEGIN
    ALTER TABLE dbo.Planilla ADD CONSTRAINT DF_Planilla_UpdatedAt DEFAULT (SYSDATETIME()) FOR updated_at;
  END;
END;
GO
