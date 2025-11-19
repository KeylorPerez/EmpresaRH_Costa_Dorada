# Manual técnico del sistema de Recursos Humanos

## 1. Visión general
El proyecto se divide en dos aplicaciones:
- **Backend (Node.js/Express + SQL Server):** expone una API REST para la gestión de empleados, asistencia, planillas, vacaciones, préstamos, liquidaciones, aguinaldos y usuarios. Todas las rutas se registran en `index.js`, se sirven archivos generados desde `backend/exports` y se protege el acceso con JWT y control de roles. 
- **Frontend (React + Vite + Tailwind):** aplica rutas protegidas por rol (administrador vs. empleado) y consume los servicios REST mediante `axios`.

## 2. Backend
### 2.1 Arranque y configuración
- **Scripts:** `npm start` (producción) y `npm run dev` (con Nodemon) definidos en `backend/package.json`.
- **Variables de entorno (.env):**
  - `PORT` (puerto del API, por defecto 3000).
  - `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE`, `DB_PORT` para la conexión SQL Server.
  - `JWT_SECRET` para firmar tokens.
  - `OFFICE_LATITUDE`, `OFFICE_LONGITUDE` y `OFFICE_RADIUS_METERS` definen la geocerca para las
    marcaciones. Actualmente se utiliza `9.934739`, `-84.087502` y un radio de 120 m.
- **Conexión a BD:** `backend/db/db.js` crea un `ConnectionPool` reutilizable (`poolPromise`) y exporta el objeto `sql` para tipar parámetros. El cifrado se desactiva por defecto y se confía en certificados locales.
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
3. Cada petición protegida incluye `Authorization: Bearer <token>`; el middleware recupera el usuario, confirma que siga activo y añade `req.user`.

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

## 3. Frontend
### 3.1 Arranque y build
- **Scripts:** `npm run dev` (servidor Vite), `npm run build` (bundle de producción), `npm run preview` (servido del build) y `npm run lint`.
- **Variables de entorno:** además de `VITE_API_URL`, la app lee `VITE_BUSINESS_LATITUDE`,
  `VITE_BUSINESS_LONGITUDE` y `VITE_BUSINESS_RADIUS_METERS` para mostrar al usuario la zona de
  marcación configurada en el backend.
- **Stack:** React 19 con React Router 7, Axios para HTTP, Tailwind 4 para estilos.

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

## 4. Ejecución local
1. Crear dos archivos `.env` (en `backend` y `frontend` si se requiere una base de URL para Axios). En backend, definir variables de base de datos y `JWT_SECRET`.
2. Instalar dependencias en cada carpeta con `npm install`.
3. Iniciar la API: `cd backend && npm run dev`.
4. Iniciar el frontend: `cd frontend && npm run dev`; Vite mostrará la URL de desarrollo (por defecto `http://localhost:5173`).

## 5. Despliegue
- **Backend:** ejecutar `npm start` tras construir la imagen o copiar el código; configurar las variables de entorno anteriores y abrir el puerto definido en `PORT`. Asegurar conectividad segura hacia SQL Server.
- **Frontend:** ejecutar `npm run build` y servir la carpeta `dist` con un servidor estático o CDN. Configurar la URL base de la API en las variables de entorno/servicio Axios.

## 6. Mantenimiento y troubleshooting
- Revisar los logs de arranque del backend para confirmar conexión a SQL Server y creación del directorio `backend/exports`.
- Si las peticiones devuelven 401/403, verificar validez del token y estado del usuario en BD.
- Ante errores de base de datos, validar que los tipos enviados desde el frontend coincidan con los definidos en los modelos (por ejemplo, `Decimal(12,2)` para montos salariales).
- Usar `npm run lint` en frontend para detectar problemas de código antes de compilar.
