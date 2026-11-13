# Taller Semana 11 - API REST de Libros con Express, PostgreSQL y JWT

API REST para gestionar libros. Incluye autenticacion con JWT, contrasena almacenada con hash bcrypt, registro de usuarios, validacion de datos, CRUD completo, persistencia real en PostgreSQL y una interfaz web simple servida por el mismo Express.

Entidad elegida: **libros**.

| Campo | Tipo | Obligatorio |
| --- | --- | --- |
| id | entero serial | generado por la base de datos |
| titulo | texto (max. 150) | si |
| autor | texto (max. 100) | si |
| anio | entero | si |
| creado_en | timestamp | generado por la base de datos |
| actualizado_en | timestamp | generado por la base de datos |

## Requisitos

- Node.js 18 o superior
- PostgreSQL en ejecucion
- Postman

## Estructura del proyecto

```
Taller_sem11/
  src/
    app.js                        Configuracion de Express y montaje de rutas
    server.js                     Arranque del servidor y cierre ordenado
    config/
      env.js                      Lectura y validacion de variables de entorno
      db.js                       Pool de conexiones a PostgreSQL
    middleware/
      auth.js                     Verificacion del JWT (firma y expiracion)
      error-handler.js            Respuestas JSON uniformes para errores
    routes/
      auth.routes.js              POST /auth/login
      libros.routes.js            CRUD de libros protegido con JWT
    controllers/
      auth.controller.js          Login y registro de usuarios
      libros.controller.js        Logica HTTP del CRUD
    repositories/
      libros.repository.js        Consultas SQL parametrizadas
    utils/
      validators.js               Validacion de campos e identificadores
      http-error.js               Error con codigo HTTP
  sql/schema.sql                  Creacion de tablas
  scripts/
    init-db.js                    Crea la base, aplica el esquema y crea el usuario de prueba
    check-db.js                   Consulta directa para evidencias
    smoke-test.js                 Pruebas automatizadas de la API y de la base de datos
    generar-token-expirado.js     Genera un JWT vencido para demostrar el rechazo 401
    evidencia-persistencia.ps1    Evidencia automatica con reinicio del servidor
  postman/
    Taller_Sem11.postman_collection.json
  public/
    index.html                    Interfaz web: login y gestion de libros
    styles.css                    Estilos de la interfaz
    app.js                        Cliente de la API, sesion JWT y renderizado
    favicon.svg                   Icono de la aplicacion
  GUIA_REVISION.md                Guia paso a paso para la revision y preguntas tecnicas
  .env.example                    Plantilla de variables de entorno
```

## 1. Instalar dependencias

```powershell
npm install
```

## 2. Configurar variables de entorno

Copiar la plantilla y completar los valores locales:

```powershell
Copy-Item .env.example .env
```

Generar un secreto para firmar los JWT:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Contenido esperado del `.env` (usar valores propios):

```ini
PORT=3000
DATABASE_URL=postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/taller_api
JWT_SECRET=EL_SECRETO_ALEATORIO_GENERADO
JWT_EXPIRES_IN=1h
APP_USER=docente
APP_PASSWORD=UNA_CONTRASENA_DE_PRUEBA
```

`DATABASE_URL`, `JWT_SECRET` y `APP_PASSWORD` son obligatorios. El secreto JWT debe tener al menos 32 caracteres.

**Importante:** el archivo `.env` contiene secretos y ya esta incluido en `.gitignore`. No se debe entregar ni publicar.

## 3. Inicializar la base de datos y el usuario de prueba

```powershell
npm run db:init
```

Este procedimiento local:

1. Crea la base de datos indicada en `DATABASE_URL` si no existe.
2. Crea las tablas `usuarios` y `libros` con `sql/schema.sql`.
3. Toma `APP_USER` y `APP_PASSWORD` del `.env`, calcula un hash bcrypt con costo 12 y guarda **solo el hash** en la tabla `usuarios`.

El script es idempotente: se puede ejecutar de nuevo y actualiza el hash del usuario de prueba sin duplicarlo.

## 4. Ejecutar la API y la interfaz

```powershell
npm start
```

La API queda disponible en `http://localhost:3000` y la interfaz web en `http://localhost:3000/`.

## Interfaz web

La interfaz es HTML, CSS y JavaScript sin frameworks, servida desde `public/` por el mismo servidor Express. Permite:

- Iniciar sesion con usuario y contrasena y guardar el JWT en `sessionStorage`.
- Crear un usuario nuevo desde el boton **Crear usuario nuevo** y entrar automaticamente.
- Listar y filtrar libros por titulo o autor.
- Crear libros con validacion de campos.
- Editar un libro cargando sus datos en el formulario.
- Eliminar libros con confirmacion.
- Cerrar sesion y eliminar el token del navegador.
- Detectar token vencido o invalido y volver automaticamente al login.

Todas las operaciones de datos siguen usando las rutas protegidas de la API. La interfaz nunca guarda la contrasena ni muestra el token.

Evidencias de la interfaz: `evidencias/interfaz-login.png`, `evidencias/interfaz-registro.png`, `evidencias/interfaz-libros.png` e informe automatizado en `evidencias/interfaz-e2e.txt`.

## Endpoints

| Metodo | Ruta | JWT | Resultado |
| --- | --- | --- | --- |
| GET | / | No | Interfaz web de login y gestion de libros |
| POST | /auth/login | No | Valida credenciales y devuelve un JWT con vencimiento |
| POST | /auth/register | No | Crea un usuario nuevo con contrasena hasheada (201) |
| GET | /libros | Si | Lista los libros almacenados (200) |
| POST | /libros | Si | Crea un libro y devuelve su id (201) |
| GET | /libros/:id | Si | Consulta un libro por id (200 o 404) |
| PUT | /libros/:id | Si | Actualiza campos enviados (200 o 404) |
| DELETE | /libros/:id | Si | Elimina el libro (200 o 404) |

Todas las rutas de `/libros` pasan primero por el middleware `requireAuth`. Si falta el encabezado `Authorization`, el token es invalido o esta vencido, la API responde `401` sin ejecutar la consulta.

### Ejemplo de login

```http
POST /auth/login
Content-Type: application/json

{
  "usuario": "docente",
  "password": "TU_CONTRASENA_DE_PRUEBA"
}
```

Respuesta `200`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "usuario": "docente"
}
```

### Ejemplo de registro de usuario

```http
POST /auth/register
Content-Type: application/json

{
  "usuario": "maria.lopez",
  "password": "ClaveSegura123"
}
```

Respuesta `201`:

```json
{
  "id": 2,
  "usuario": "maria.lopez",
  "creado_en": "2026-11-13T..."
}
```

El usuario se normaliza a minusculas, la contrasena se guarda como hash bcrypt y un nombre repetido responde `409`. La interfaz permite registrarse y entra automaticamente despues de crear la cuenta.

### Ejemplo de peticion protegida

```http
POST /libros
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "titulo": "El principito",
  "autor": "Antoine de Saint-Exupery",
  "anio": 1943
}
```

Respuesta `201`:

```json
{
  "id": 1,
  "titulo": "El principito",
  "autor": "Antoine de Saint-Exupery",
  "anio": 1943,
  "creado_en": "2026-11-13T...",
  "actualizado_en": "2026-11-13T..."
}
```

## Pruebas en Postman

1. Importar `postman/Taller_Sem11.postman_collection.json`.
2. Abrir las variables de la coleccion y asignar `passwordDemo` con el valor de `APP_PASSWORD`. `usuarioDemo` ya tiene el valor `docente` y `baseUrl` apunta a `http://localhost:3000`.
3. Ejecutar `Login correcto`. El script de prueba guarda automaticamente el JWT en la variable `token`.
4. Opcionalmente ejecutar `Registrar usuario`: genera un nombre unico, crea la cuenta y comprueba que no se devuelve el hash.
5. Ejecutar `Crear libro`. El script guarda el id en la variable `libroId`.
6. Ejecutar `Listar libros`, `Obtener libro por id`, `Actualizar libro`, `Eliminar libro` y `Verificar libro eliminado (404)`.
7. Ejecutar las peticiones de la carpeta `03 Seguridad y validacion`: deben responder 401 o 400 y no modificar la base de datos.

La coleccion usa autenticacion Bearer a nivel de coleccion con `{{token}}`. Las peticiones de login y las pruebas sin token usan `No Auth`.

## Evidencias y verificacion de persistencia

### Pruebas automatizadas

Con el servidor detenido o en ejecucion (el script levanta su propia instancia en un puerto libre):

```powershell
npm run test:smoke
```

El script comprueba login, rechazo de credenciales, 401 sin token / token invalido / token vencido, validacion 400, creacion 201, consultas, actualizacion, eliminacion y consultas directas a PostgreSQL. El resultado se guarda en `evidencias/pruebas-automatizadas.txt` si se ejecuta con:

```powershell
node scripts/smoke-test.js 2>&1 | Out-File -FilePath evidencias\pruebas-automatizadas.txt -Encoding utf8
```

### Consulta directa a PostgreSQL

```powershell
npm run db:check
```

O con `psql`:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -U postgres -d taller_api -c "SELECT * FROM libros ORDER BY id;"
```

```sql
SELECT id, titulo, autor, anio, actualizado_en FROM libros ORDER BY id;
SELECT id, usuario, LEFT(password_hash, 20) || '...' FROM usuarios;
```

### Persistencia despues de reiniciar el servidor

1. Crear un libro con `POST /libros` y anotar su `id`.
2. Detener el proceso con `Ctrl+C`.
3. Ejecutar de nuevo `npm start`.
4. Consultar `GET /libros/:id` con el mismo token vigente: el registro debe seguir existiendo.
5. Verificar el mismo registro con `psql` o con `npm run db:check`.

La persistencia no depende de memoria ni de archivos JSON: los datos viven en las tablas de PostgreSQL.

### Evidencia incluida

- `evidencias/pruebas-automatizadas.txt`: salida de las pruebas de API y base de datos.
- `evidencias/persistencia-postgresql.txt`: flujo login, creacion, actualizacion, reinicio, consulta y eliminacion con consultas directas a PostgreSQL.
- `evidencias/postman-newman.txt`: ejecucion de la coleccion de Postman (20 peticiones, 32 aserciones, 0 fallos), con autenticacion, CRUD, registro y seguridad.
- `evidencias/estado-base-datos.txt`: consulta directa del estado final de las tablas.
- `evidencias/interfaz-e2e.txt`: prueba automatizada de la interfaz (24 comprobaciones: registro, login, CRUD, filtro, validaciones y cierre de sesion).
- `evidencias/interfaz-login.png`, `evidencias/interfaz-registro.png` y `evidencias/interfaz-libros.png`: capturas de la interfaz.

Para regenerar la evidencia de persistencia (inicia y reinicia el servidor automaticamente, y lee las credenciales del `.env`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\evidencia-persistencia.ps1 *>&1 | Out-File -FilePath .\evidencias\persistencia-postgresql.txt -Encoding utf8
```

Opcionalmente, la misma coleccion se puede ejecutar desde consola con Newman o Postman CLI:

```powershell
npx --yes newman run postman\Taller_Sem11.postman_collection.json `
  --env-var "baseUrl=http://127.0.0.1:3000" `
  --env-var "usuarioDemo=docente" `
  --env-var "passwordDemo=TU_CONTRASENA_DE_PRUEBA"
```

## Seguridad aplicada

- Credenciales y secreto JWT se leen desde variables de entorno; no estan escritos en el codigo.
- La contrasena del usuario de prueba y de los usuarios nuevos se almacena como hash bcrypt, nunca en texto plano.
- El registro valida longitud y formato del usuario, minimo de contrasena y rechaza duplicados con `409`.
- El JWT se firma con HS256, incluye `sub`, `usuario`, `iat` y `exp`, y se verifica en `src/middleware/auth.js`.
- Las cinco rutas del CRUD se probaron sin token y con token invalido; las pruebas automatizadas cubren ademas token vencido en las cinco rutas y firma invalida. Todas responden `401` y no modifican la base de datos.
- Las consultas SQL usan parametros (`$1`, `$2`, ...) para evitar inyeccion SQL.
- La actualizacion dinamica solo acepta los campos permitidos por `validarLibro`.
- Los errores no exponen trazas internas ni secretos en las respuestas.
- El cuerpo JSON tiene un limite de 100 kb.

## Flujo de una peticion protegida

1. `POST /auth/login` busca el usuario, compara la contrasena con bcrypt y firma el JWT.
2. El cliente envia `Authorization: Bearer <token>`.
3. `src/routes/libros.routes.js` aplica `requireAuth` antes del controlador.
4. `requireAuth` verifica firma, algoritmo y expiracion; si falla responde 401.
5. El controlador valida el cuerpo con `src/utils/validators.js`.
6. El repositorio ejecuta la consulta parametrizada en PostgreSQL.
7. El controlador responde JSON con el codigo HTTP real de la operacion.

## Revision

La guia paso a paso para la revision, con el flujo completo, consultas directas a la base de datos, pruebas de seguridad y respuestas a preguntas tecnicas, esta en `GUIA_REVISION.md`.

## Entrega

Incluir el codigo fuente, `sql/schema.sql`, la coleccion de Postman, el README y la carpeta `evidencias`. **No incluir** `node_modules` ni `.env`.
