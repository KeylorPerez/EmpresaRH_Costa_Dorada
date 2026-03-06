# Manual técnico del sistema de Recursos Humanos

## 1. Visión general
El proyecto se divide en dos aplicaciones principales y dos targets de entrega (web/PWA y escritorio):
- **Backend (Node.js/Express + SQL Server):** expone una API REST para la gestión de empleados, asistencia, planillas, vacaciones, préstamos, liquidaciones, aguinaldos y usuarios. Todas las rutas se registran en `index.js`, se sirven archivos generados desde `backend/exports` y se protege el acceso con JWT y control de roles.
- **Frontend (React + Vite + Tailwind):** aplica rutas protegidas por rol (administrador vs. empleado) y consume los servicios REST mediante `axios`. La misma base se usa para la aplicación web tradicional y la PWA.

## 2. Backend
### 2.1 Arranque y configuración
- **Scripts:** `npm start` (producción) y `npm run dev` (con Nodemon) definidos en `backend/package.json`.
- **Variables de entorno (.env):**
  - `PORT` (puerto del API, por defecto 3000).
  - `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE`, `DB_PORT` para la conexión SQL Server.
  - `JWT_SECRET` para firmar tokens.
  - `SESSION_INACTIVITY_MINUTES` (opcional) para definir el cierre automático por inactividad; por defecto 15 minutos.
  - `OFFICE_LATITUDE`, `OFFICE_LONGITUDE` y `OFFICE_RADIUS_METERS` definen la geocerca para las
    marcaciones. Actualmente se utiliza `10.34113265735398`, `-83.73774991896887` y un radio de
    150 m (con tolerancia `OFFICE_RADIUS_TOLERANCE_METERS`, por defecto 0 m).
- **Conexión a BD:** `backend/db/db.js` crea un `ConnectionPool` reutilizable (`poolPromise`) y exporta el objeto `sql` para tipar parámetros. El cifrado se desactiva por defecto y se confía en certificados locales.


### 2.1.1 Configuración recomendada para SQL Server local (SSMS + API)
Para que SSMS y el backend usen exactamente el mismo destino de base de datos en desarrollo local:

- **Backend (`backend/.env`)**
  - `DB_SERVER=localhost`
  - `DB_PORT=1433`
  - `DB_DATABASE=EmpresaRH`
  - `DB_USER=<usuario_sql>`
  - `DB_PASSWORD=<password_sql>`

- **SSMS (pantalla Conectar)**
  - **Nombre del servidor:** `localhost,1433`
  - **Autenticación:** `SQL Server Authentication` (usar el mismo usuario/clave de `DB_USER` y `DB_PASSWORD`)
  - **Nombre de la base de datos:** `EmpresaRH` (opcional en la conexión inicial, pero recomendado)

> Nota: si defines `DB_PORT`, el backend prioriza conexión por puerto y no depende de `DB_INSTANCE`/SQL Browser.
- **Middleware global:** CORS, `express.json()` y exposición estática de `/files` apuntando a `backend/exports`.

### 2.2 Estructura de módulos
- **Rutas principales:**
  - `/api/empleados` (CRUD + activación/desactivación + exportación).
  - `/api/usuarios`, `/api/auth` (login), `/api/asistencia`, `/api/vacaciones`, `/api/prestamos`, `/api/planilla`, `/api/liquidaciones`, `/api/puestos`, `/api/aguinaldos`.
- **Autenticación y autorización:** `middleware/authMiddleware.js` valida el JWT con `authenticateToken` y restringe endpoints con `authorizeRoles(...roles)`.
- **Controladores:** ubicados en `backend/controllers/*.js`, encapsulan la lógica de negocio y orquestan los modelos.
- **Modelos:** `backend/models/*.js` ejecutan consultas SQL tipadas. Ejemplo: `Empleado` provee `getAll`, `getById`, `create`, `update`, `deactivate`, `activate` para la tabla `Empleados`.

### 2.3 Flujo de autenticación
1. El cliente envía `username` y `password` a `/api/auth/login`.
2. `authController` valida credenciales (comparando el hash con `bcryptjs`), verifica que el usuario esté activo y emite un JWT con `id_usuario`, `username` e `id_rol` válido por 8 horas.
3. Cada petición protegida incluye `Authorization: Bearer <token>`; el middleware recupera el usuario, confirma que siga activo, aplica un límite de inactividad (15 minutos por defecto, configurable con `SESSION_INACTIVITY_MINUTES`) y añade `req.user`.

### 2.4 Gestión de empleados (ejemplo de módulo)
- **Endpoints:**
  - `GET /api/empleados` (autenticado) devuelve todos los empleados con el nombre del puesto.
  - `GET /api/empleados/:id` obtiene un empleado por ID.
  - `POST /api/empleados` crea un registro; requiere rol administrador (id_rol = 1).
  - `PUT /api/empleados/:id` actualiza datos básicos, parámetros salariales y estado.
  - `PATCH /api/empleados/:id/desactivar` y `/activar` realizan soft delete/reactivación.
  - `GET /api/empleados/export` genera y expone archivos desde `/files` (solo administrador).
- **Modelo:** el método `create` inserta el registro y devuelve `SCOPE_IDENTITY()`, mientras `update` usa `COALESCE` para conservar valores existentes cuando el cuerpo no los incluye.

### 2.5 Consideraciones de seguridad y buenas prácticas
- Mantener `JWT_SECRET` privado y rotarlo periódicamente.
- Habilitar `encrypt: true` en `db/db.js` si se despliega en Azure u otros entornos con TLS.
- Limitar permisos de roles en rutas sensibles mediante `authorizeRoles`.
- Implementar validaciones de entrada y manejo de errores consistente en todos los controladores (actualmente algunos propagan errores directos de la base de datos).

### 2.6 Esquema de la tabla Planilla
- La API de planillas espera que los montos (`deducciones`, `horas_extras`, `bonificaciones`, `ccss_deduccion`, `pago_neto`) y las marcas de auditoría (`created_at`, `updated_at`) sean **NOT NULL** con valores predeterminados; además usa la bandera `es_automatica` para distinguir cálculos manuales vs. automáticos.
- Si la tabla proviene de un script antiguo (como el compartido sin `es_automatica` y con columnas en `NULL`), los inserts/updates pueden fallar al castear el bit o al sumar montos `NULL`.
- Ejecute `docs/sql/planilla_table.sql` en SQL Server Management Studio: crea la tabla si no existe, agrega la columna `es_automatica` y establece defaults para los montos y timestamps sin perder los datos actuales.
- Antes de aplicar los `ALTER`, normalice posibles `NULL` para evitar errores de restricción:
  ```sql
  UPDATE Planilla
  SET deducciones    = ISNULL(deducciones, 0),
      horas_extras   = ISNULL(horas_extras, 0),
      bonificaciones = ISNULL(bonificaciones, 0),
      ccss_deduccion = ISNULL(ccss_deduccion, 0),
      es_automatica  = ISNULL(es_automatica, 1),
      created_at     = ISNULL(created_at, SYSDATETIME()),
      updated_at     = ISNULL(updated_at, SYSDATETIME());
  ```

## 3. Frontend
### 3.1 Arranque y build
- **Scripts:** `npm run dev` (servidor Vite), `npm run build` (bundle de producción), `npm run preview` (servido del build) y `npm run lint`.
- **Variables de entorno:** además de `VITE_API_URL`, la app lee `VITE_BUSINESS_LATITUDE`,
  `VITE_BUSINESS_LONGITUDE` y `VITE_BUSINESS_RADIUS_METERS` para mostrar al usuario la zona de
  marcación configurada en el backend.
- **Stack:** React 19 con React Router 7, Axios para HTTP, Tailwind 4 para estilos.
- **Router:** se utiliza `HashRouter` para mantener compatibilidad entre PWA y servidores estáticos.

### 3.2 Ruteo y autorización
- `src/routes/AppRouter.jsx` define todas las rutas y aplica `PrivateRoute`, que recibe `allowedRoles` y redirige a `/login` si no hay sesión válida. Rutas destacadas:
  - `/login` (formulario de autenticación) y `/acerca` (página informativa).
  - Prefijo `/admin/*` protegido para rol 1, incluyendo módulos de empleados, puestos, usuarios, planillas, asistencia, vacaciones, préstamos, liquidaciones y aguinaldos.
  - Prefijo `/empleado/*` protegido para rol 2, con vistas de asistencia, vacaciones, préstamos, liquidaciones y aguinaldos.
  - Ruta comodín redirige a `/login`.

### 3.3 Consumo de API y estado
- Los servicios en `src/services/*.js` envían peticiones con Axios hacia los endpoints del backend; se espera que el token se propague en los encabezados.
- El componente `AuthForm` maneja el login y almacena el token en el contexto/autenticación (revisar `src/context` para la implementación exacta).

### 3.4 Estilos y assets
- Tailwind 4 se configura a través de `@tailwindcss/vite` y las hojas `App.css`/`index.css`. Los íconos provienen de `react-icons`.

### 3.5 Progressive Web App (PWA)
- **Manifest y assets:** `frontend/manifest.json` define nombre corto, colores y los íconos (`/icons/icon-192.png` y `/icons/icon-512.png`). El `start_url` y `scope` son `/` para permitir instalación en dominio raíz.
- **Service Worker:** `public/sw.js` aplica estrategia _online-first_ y se registra en `src/main.jsx` tras el evento `load` cuando corre en navegador.
- **Instalación:** en producción, servir los assets estáticos de `dist` asegurando que `manifest.json` y `sw.js` sean accesibles en la raíz del dominio. Navegadores compatibles ofrecerán la instalación como app.

## 4. Ejecución local
1. Crear dos archivos `.env` (en `backend` y `frontend` si se requiere una base de URL para Axios). En backend, definir variables de base de datos y `JWT_SECRET`.
2. Instalar dependencias en cada carpeta con `npm install`.
3. Iniciar la API: `cd backend && npm run dev`.
4. Iniciar el frontend: `cd frontend && npm run dev`; Vite mostrará la URL de desarrollo (por defecto `http://localhost:5173`).

## 5. Despliegue
- **Backend:** ejecutar `npm start` tras construir la imagen o copiar el código; configurar las variables de entorno anteriores y abrir el puerto definido en `PORT`. Asegurar conectividad segura hacia SQL Server.
- **Frontend (web/PWA):** ejecutar `npm run build` y servir la carpeta `dist` con un servidor estático o CDN. Configurar la URL base de la API en las variables de entorno/servicio Axios y asegurarse de exponer `manifest.json`, los íconos y `sw.js` en la raíz.

## 6. Mantenimiento y troubleshooting
- Revisar los logs de arranque del backend para confirmar conexión a SQL Server y creación del directorio `backend/exports`.
- Si las peticiones devuelven 401/403, verificar validez del token y estado del usuario en BD.
- Ante errores de base de datos, validar que los tipos enviados desde el frontend coincidan con los definidos en los modelos (por ejemplo, `Decimal(12,2)` para montos salariales).
- Usar `npm run lint` en frontend para detectar problemas de código antes de compilar.
