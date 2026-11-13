# Guia de revision - API REST de libros con Express, PostgreSQL y JWT

Esta guia sirve para demostrar, en la revision, que la API cumple las directrices y que la persistencia es real. La idea central es mostrar el flujo completo:

**login -> JWT -> peticion protegida -> operacion en PostgreSQL -> respuesta JSON -> consulta directa a la base de datos**

Una respuesta `201` o `200` en Postman no prueba por si sola la persistencia. Siempre hay que mostrar el registro en PostgreSQL y, cuando corresponda, reiniciar el servidor y volver a consultarlo.

## 1. Cumplimiento de las directrices

| Directriz | Donde esta implementada | Como se demuestra |
| --- | --- | --- |
| API REST con Node.js y Express, respuestas JSON | `src/app.js`, `src/routes/`, `src/controllers/` | Peticiones de Postman con `Content-Type: application/json` |
| Persistencia real en PostgreSQL, no en memoria | `src/config/db.js`, `sql/schema.sql`, `src/repositories/libros.repository.js` | `npm run db:check` o `psql` despues de cada operacion |
| Entidad con al menos 4 campos y CRUD completo | `libros`: `id`, `titulo`, `autor`, `anio`, `creado_en`, `actualizado_en` | Peticiones de crear, listar, obtener, actualizar y eliminar |
| Login con JWT firmado y con vencimiento | `src/controllers/auth.controller.js:31-39` | `POST /auth/login` devuelve `token`, `tokenType` y `expiresIn` |
| Middleware que verifica firma y expiracion antes del CRUD | `src/middleware/auth.js:4-33`, `src/routes/libros.routes.js:7` | Peticiones sin token, con token invalido y con token vencido responden `401` |
| Contrasena almacenada con hash, no en texto plano | `scripts/init-db.js`, `src/controllers/auth.controller.js:23-24` | Consulta a `usuarios` muestra solo un hash bcrypt parcial |
| Credenciales y secreto fuera del codigo | `.env`, `src/config/env.js` | El codigo no contiene contrasenas ni el secreto JWT |
| Validacion de datos obligatorios | `src/utils/validators.js:9-67`, `:69-83` | Un campo faltante responde `400` con `details` |
| Codigos HTTP correctos | Controladores y `src/middleware/error-handler.js` | `201`, `200`, `400`, `401`, `404`, `409` segun el caso |
| Pruebas en Postman de todos los casos obligatorios | `postman/Taller_Sem11.postman_collection.json` | 20 peticiones y 32 aserciones documentadas en `evidencias/postman-newman.txt` |
| Verificacion de persistencia tras reiniciar el servidor | `scripts/evidencia-persistencia.ps1` | `evidencias/persistencia-postgresql.txt` |
| No entregar secretos ni `node_modules` | `.gitignore`, `README.md` | Revision final de la carpeta antes de entregar |

La coleccion de Postman ya incluye las cinco rutas del CRUD sin token y las cinco con token invalido. Las pruebas automatizadas cubren ademas token vencido en las cinco rutas, firma invalida y comprueban que la cantidad de filas no cambia (`scripts/smoke-test.js:127-162`).

## 2. Preparacion antes de la revision

Ejecutar desde la raiz del proyecto:

```powershell
npm install
npm run db:init
npm start
```

Comprobar que la API responde:

```powershell
(Invoke-WebRequest -Uri http://127.0.0.1:3000/ -UseBasicParsing).StatusCode
```

Si aparece un error de puerto ocupado (`EADDRINUSE`), detener el servidor anterior con `Ctrl + C` antes de iniciar otro.

En Postman:

1. Importar `postman/Taller_Sem11.postman_collection.json`.
2. Verificar que `baseUrl` sea `http://localhost:3000`.
3. Asignar a `passwordDemo` el valor local de `APP_PASSWORD` del `.env`. No pegar ese valor en capturas ni en el README.
4. Ejecutar primero **Login correcto**. El script de prueba guarda el JWT en la variable de coleccion `token`.
5. Confirmar que la autorizacion de la coleccion es `Bearer {{token}}`.

## 3. Guion de demostracion del flujo obligatorio

### Paso 1: login y obtencion del JWT

Ejecutar **01 Autenticacion > Login correcto**.

Resultado esperado:

- HTTP `200`.
- JSON con `token`, `tokenType: "Bearer"`, `expiresIn` y `usuario`.
- El token queda guardado en la variable `token` de Postman.

Que explicar: el servidor busca el usuario en PostgreSQL, compara la contrasena con bcrypt y firma un JWT con `sub`, `usuario`, `iat` y `exp`. El secreto se lee de `JWT_SECRET` y nunca se devuelve.

### Paso 2: peticion protegida que crea un registro

Ejecutar **02 CRUD con JWT > Crear libro**.

Resultado esperado:

- HTTP `201`.
- JSON con `id`, `titulo`, `autor`, `anio`, `creado_en`, `actualizado_en`.
- El `id` queda guardado en la variable `libroId`.

Que explicar: la peticion lleva `Authorization: Bearer <token>`. `requireAuth` valida la firma y la expiracion antes de que se ejecute el controlador. Si el token no es valido, el controlador y la consulta SQL nunca se ejecutan.

### Paso 3: demostrar que el registro esta en PostgreSQL

Ejecutar una de estas dos opciones.

Opcion A, consulta del proyecto:

```powershell
npm run db:check
```

Opcion B, consulta directa con `psql` (reemplazar `TU_PASSWORD`):

```powershell
psql "postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/taller_api" -c "SELECT id, titulo, autor, anio, creado_en, actualizado_en FROM libros ORDER BY id;"
```

Que mostrar en pantalla:

- La tabla `libros` existe.
- El `id` devuelto por la API aparece como fila real.
- `creado_en` y `actualizado_en` tienen valores generados por PostgreSQL.

Esta consulta es la prueba de persistencia. No alcanza con mostrar el `201` de Postman.

### Paso 4: listar y obtener el registro

Ejecutar **Listar libros** y **Obtener libro por id**.

Resultado esperado:

- HTTP `200` en ambas.
- La lista contiene el libro creado.
- La consulta por id devuelve exactamente ese registro.

### Paso 5: actualizar y verificar en la API y en la base de datos

Ejecutar **Actualizar libro**, cambiando por ejemplo `titulo` y `anio`.

Resultado esperado:

- HTTP `200`.
- La respuesta muestra los nuevos valores.
- Los campos no enviados se conservan.
- `actualizado_en` cambia.

Verificar directamente en PostgreSQL:

```powershell
psql "postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/taller_api" -c "SELECT id, titulo, autor, anio, creado_en, actualizado_en FROM libros WHERE id = ID_DEL_LIBRO;"
```

Reemplazar `ID_DEL_LIBRO` por el id real. La consulta debe mostrar el titulo actualizado y una marca de tiempo de actualizacion mas reciente.

### Paso 6: reiniciar el servidor y comprobar persistencia

1. Detener el servidor con `Ctrl + C`.
2. Volver a iniciar con `npm start`.
3. En Postman, ejecutar **Obtener libro por id** con el mismo JWT.
4. Consultar otra vez la fila en PostgreSQL.

Resultado esperado:

- HTTP `200`.
- El registro sigue existiendo con los datos actualizados.
- La consulta directa devuelve la misma fila.

Que explicar: si los datos estuvieran en un arreglo o en memoria, el reinicio los borraria. Como siguen en PostgreSQL, se demuestra persistencia real.

Tambien se puede generar esta evidencia de forma automatica. Detener primero cualquier servidor en el puerto 3000:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\evidencia-persistencia.ps1 *>&1 | Out-File -FilePath .\evidencias\persistencia-postgresql.txt -Encoding utf8
```

El script crea, consulta, actualiza, reinicia el servidor, vuelve a consultar, elimina y verifica el `404`.

### Paso 7: eliminar y verificar la desaparicion

Ejecutar **Eliminar libro** y luego **Verificar libro eliminado (404)**.

Resultado esperado:

- `DELETE` responde HTTP `200` y devuelve el registro eliminado.
- La consulta posterior responde HTTP `404`.
- La consulta directa a PostgreSQL devuelve `0` filas para ese id.

```powershell
psql "postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/taller_api" -c "SELECT COUNT(*) AS restantes FROM libros WHERE id = ID_DEL_LIBRO;"
```

### Paso 8: validaciones y errores controlados

Ejecutar **Crear sin campo obligatorio**. Resultado esperado: HTTP `400` y un arreglo `details` que indica el campo faltante.

Probar tambien:

- `GET /libros/abc`: HTTP `400` porque el id no es un entero positivo.
- `GET /libros/999999`: HTTP `404` porque el id es valido pero el registro no existe.
- `POST /auth/login` con contrasena incorrecta: HTTP `401` y sin token.

Que explicar: `validarLibro` y `validarId` lanzan un error con codigo HTTP; el `errorHandler` transforma ese error en una respuesta JSON uniforme y no expone trazas internas.

## 4. Demostracion de seguridad con JWT

### Sin token y token invalido

Ejecutar las peticiones de **03 Seguridad y validacion**:

- Listar sin token.
- Crear sin token.
- Obtener por id sin token.
- Actualizar sin token.
- Eliminar sin token.
- Las mismas cinco operaciones con token invalido.

Resultado esperado: HTTP `401` en todas. Antes y despues se puede ejecutar `npm run db:check` para mostrar que la cantidad de libros no cambio.

### Token vencido

El proyecto incluye un generador de token vencido:

```powershell
npm run token:expired
```

El comando imprime un JWT ya expirado, firmado con el mismo secreto local. Para probarlo en Postman:

1. Duplicar una peticion protegida, por ejemplo **Listar libros**.
2. En la pestana **Authorization**, elegir **No Auth**.
3. En **Headers**, agregar `Authorization` con el valor `Bearer TOKEN_VENCIDO`.
4. Enviar la peticion.

Resultado esperado:

- HTTP `401`.
- Mensaje `El token ha expirado. Inicia sesion nuevamente.`
- La base de datos no cambia.

Que explicar: `jwt.verify` valida la firma y el campo `exp`. Un token expirado produce `TokenExpiredError`; el middleware lo transforma en `401`. La restriccion `algorithms: ['HS256']` evita aceptar algoritmos no previstos.

### Firma invalida

Las pruebas automatizadas generan un token con otro secreto y verifican que responde `401`. Esto demuestra que no alcanza con que el token tenga formato JWT: la firma debe corresponder al secreto del servidor.

## 5. Preguntas tecnicas frecuentes y como responderlas

### 5.1 Explica el middleware JWT

Referencia: `src/middleware/auth.js:4-33`.

Respuesta esperada, con razonamiento propio:

1. Lee `req.headers.authorization` y lo separa por espacios.
2. Exige exactamente dos partes, la palabra `Bearer` y un token no vacio; si no, responde `401` sin consultar la base de datos.
3. Llama a `jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })`. Esa llamada comprueba la firma, el algoritmo permitido y la expiracion.
4. Verifica que el payload tenga `sub` y `usuario`, y arma `req.user`.
5. Si todo es correcto, llama a `next()` para pasar al controlador.
6. Si `jwt.verify` falla, distingue `TokenExpiredError` de otros errores, pero en ambos casos responde `401`.

Idea clave: el middleware es una barrera previa al controlador. No valida campos del libro ni consulta la tabla `libros`; solo decide si la peticion puede continuar.

### 5.2 Sigue una peticion `POST /libros` hasta la base de datos

Referencias: `src/app.js:10-13`, `src/routes/libros.routes.js:7-10`, `src/controllers/libros.controller.js:29-37`, `src/repositories/libros.repository.js:20-28`.

Cadena de llamadas:

1. Express recibe el JSON y lo parsea con `express.json()`.
2. `app.use('/libros', librosRoutes)` envia la peticion al router de libros.
3. `router.use(requireAuth)` ejecuta el middleware JWT antes de cualquier controlador.
4. `crear` llama a `validarLibro(req.body)`, que recorta textos, valida tipos y devuelve solo los campos permitidos.
5. `librosRepository.crear(datos)` ejecuta `INSERT INTO libros (titulo, autor, anio) VALUES ($1, $2, $3) RETURNING ...`.
6. `pg` envia la consulta al pool de PostgreSQL.
7. PostgreSQL genera `id`, `creado_en` y `actualizado_en`, y devuelve la fila insertada.
8. El controlador responde `res.status(201).json(libro)`.

Para comprobarlo, mostrar la respuesta `201`, el `id`, la fila en `psql` y luego un `GET /libros/:id`.

### 5.3 Localiza una consulta y explica su seguridad

Referencia: `src/repositories/libros.repository.js:43-49` para el `UPDATE`.

Puntos para explicar:

- Los valores viajan en el arreglo `valores` y se referencian como `$1`, `$2`, etc. No se concatenan datos del usuario en el SQL.
- Los nombres de columna solo pueden ser `titulo`, `autor` o `anio`, porque `validarLibro` construye `datos` con una lista permitida.
- `actualizado_en = NOW()` lo calcula PostgreSQL.
- `RETURNING` devuelve la fila actualizada, por eso el controlador puede responder con los datos reales.
- Si el id no existe, `rows[0]` es `undefined`, el repositorio devuelve `null` y el controlador responde `404`.

Otras consultas para ubicar rapidamente:

- Listar: `src/repositories/libros.repository.js:5-10`.
- Buscar por id: `:12-18`.
- Crear: `:20-28`.
- Eliminar: `:54-60`.

### 5.4 Diagnostica un fallo

Usar esta tabla como guia. La respuesta debe relacionar el sintoma con una causa y con una verificacion concreta.

| Sintoma | Causa probable | Donde verificar | Accion |
| --- | --- | --- | --- |
| `401` sin token | Falta `Authorization: Bearer ...` | Pestana Headers de Postman | Agregar el token obtenido en login |
| `401` con token | Token vencido, firma invalida o secreto distinto | `src/middleware/auth.js:16`, `.env` | Volver a iniciar sesion; no cambiar `JWT_SECRET` entre reinicios |
| `400` al crear | Falta un campo, tipo incorrecto o id invalido | Respuesta `details`, `src/utils/validators.js` | Corregir el cuerpo o el id |
| `404` en `/libros/:id` | El id no existe o la ruta esta mal escrita | Consulta directa en PostgreSQL | Verificar el id real |
| `404` en cualquier ruta | Ruta no registrada | `src/app.js`, `src/routes/` | Revisar metodo y ruta |
| `409` al registrar | Usuario duplicado | Tabla `usuarios` | Elegir otro usuario |
| `500` con error de conexion | PostgreSQL detenido, URL o clave incorrecta | Consola del servidor, `npm run db:check` | Iniciar PostgreSQL y revisar `DATABASE_URL` |
| `relation "libros" does not exist` | No se aplico el esquema | `npm run db:check` | Ejecutar `npm run db:init` |
| `EADDRINUSE` | Ya hay un proceso escuchando en el puerto | `Get-NetTCPConnection -LocalPort 3000` | Detener el proceso anterior o cambiar `PORT` |
| `password authentication failed` | Contrasena de PostgreSQL incorrecta | `.env` y servicio de PostgreSQL | Corregir `DATABASE_URL` |
| `invalid input syntax for type integer` | Se envio un id no numerico a una consulta | `validarId` y registro del error | Validar el id antes de consultar |

Frase util de diagnostico: primero identificar si el fallo ocurre antes de la base de datos (token, validacion, ruta), durante la consulta (conexion, tabla, SQL) o despues (formato de respuesta). Luego verificar con la herramienta adecuada, no solo adivinar.

### 5.5 Como se demuestra que hay persistencia real

Se demuestra con tres evidencias juntas:

1. La respuesta de la API con el `id` generado.
2. Una consulta directa a PostgreSQL que muestra la fila.
3. La misma fila despues de reiniciar el servidor.

El archivo `evidencias/persistencia-postgresql.txt` contiene ese flujo completo. Un `201` de Postman solo demuestra que la API respondio; no demuestra donde se guardaron los datos.

### 5.6 Por que se usan esos codigos HTTP

- `201`: se creo un recurso y se devuelve la fila creada.
- `200`: la operacion se completo y hay contenido en la respuesta.
- `400`: la peticion tiene datos o formato invalido.
- `401`: falta autenticacion o el token no es valido.
- `404`: la ruta o el registro no existe.
- `409`: hay un conflicto, por ejemplo un usuario duplicado.
- `500`: error inesperado del servidor; la respuesta no expone detalles internos.

### 5.7 Como se protegen las contrasenas y los secretos

- `scripts/init-db.js` calcula un hash bcrypt con costo 12 para el usuario de prueba.
- `registrar` usa `bcrypt.hash(password, 12)`.
- `login` usa `bcrypt.compare` y nunca compara texto plano.
- La API no devuelve `password_hash`.
- `JWT_SECRET`, `DATABASE_URL` y `APP_PASSWORD` se leen del `.env`.
- El `.env` esta en `.gitignore` y no se entrega.
- Las consultas usan parametros para evitar inyeccion SQL.
- Los errores `500` no devuelven trazas al cliente.
- El cuerpo JSON tiene un limite de 100 kb.

Mejoras que se pueden mencionar si preguntan: HTTPS, limite de intentos de login, roles de base de datos con permisos minimos, CORS restringido y rotacion de secretos.

### 5.8 Por que existe el registro de usuarios

El registro es una funcionalidad adicional solicitada para la interfaz. No reemplaza el login ni deja publico el CRUD: `POST /auth/register` es publico, valida el usuario, normaliza a minusculas, guarda el hash y responde `201`. Un duplicado responde `409`. Todas las rutas de `/libros` siguen protegidas por JWT.

En un entorno real convendria limitar o deshabilitar el registro publico, agregar verificacion de correo y proteccion contra abuso.

### 5.9 Que papel tiene la interfaz web

La interfaz es una capa adicional sobre la misma API. Guarda el JWT en `sessionStorage`, envia el encabezado `Authorization` y, si recibe `401`, elimina la sesion y vuelve al login. No reemplaza la verificacion de persistencia: las pruebas de interfaz se complementan con consultas directas a PostgreSQL.

### 5.10 Como responder una pregunta individual

Usar esta estructura breve:

1. **Contexto:** que parte del flujo se esta explicando.
2. **Evidencia:** archivo y linea, o peticion concreta que se puede mostrar.
3. **Razonamiento:** por que esa decision evita el fallo o cumple la directriz.
4. **Verificacion:** que comando o consulta demuestra que la explicacion es correcta.

Ejemplo: "El middleware esta en `src/middleware/auth.js:4-33` y se aplica antes del CRUD en `src/routes/libros.routes.js:7`. Verifica firma y expiracion con `jwt.verify`; si falla, responde `401` y el controlador no se ejecuta. Lo compruebo enviando `GET /libros` sin token y consultando que la tabla no cambia."

No conviene memorizar frases: conviene poder abrir el archivo, senalar la linea y ejecutar la peticion que demuestra la respuesta.

## 6. Verificacion final antes de entregar

- [ ] `npm run db:init` ejecutado y usuario de prueba disponible.
- [ ] `npm start` funciona y la API responde en `http://localhost:3000`.
- [ ] `npm run test:smoke` termina sin fallos.
- [ ] La coleccion de Postman se ejecuta completa: 20 peticiones, 32 aserciones, 0 fallos.
- [ ] `evidencias/postman-newman.txt` actualizado.
- [ ] `evidencias/persistencia-postgresql.txt` actualizado con el reinicio.
- [ ] `evidencias/estado-base-datos.txt` actualizado.
- [ ] Capturas de login, registro y libros sin contrasenas ni tokens visibles.
- [ ] Base de datos sin libros de prueba sobrantes.
- [ ] `.env` excluido de la entrega.
- [ ] `.env.example` solo contiene marcadores de posicion, no secretos reales.
- [ ] `node_modules` excluido de la entrega.
- [ ] `README.md` y esta guia incluidos.

Comando rapido para dejar la tabla de libros limpia antes de una demostracion:

```powershell
psql "postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/taller_api" -c "DELETE FROM libros;"
```

No ejecutar ese `DELETE` durante la revision si se esta mostrando un registro creado para la demostracion.

## 7. Comandos de referencia

```powershell
# Instalar dependencias
npm install

# Crear o actualizar la base y el usuario de prueba
npm run db:init

# Iniciar la API y la interfaz
npm start

# Consultar directamente PostgreSQL desde el proyecto
npm run db:check

# Ejecutar todas las pruebas automatizadas
npm run test:smoke

# Generar un JWT vencido para probar el 401
npm run token:expired

# Ejecutar la coleccion con Postman CLI
postman collection run postman\Taller_Sem11.postman_collection.json `
  --env-var "baseUrl=http://127.0.0.1:3000" `
  --env-var "usuarioDemo=docente" `
  --env-var "passwordDemo=TU_CONTRASENA_DE_PRUEBA"

# Ejecutar la coleccion con Newman
npx --yes newman run postman\Taller_Sem11.postman_collection.json `
  --env-var "baseUrl=http://127.0.0.1:3000" `
  --env-var "usuarioDemo=docente" `
  --env-var "passwordDemo=TU_CONTRASENA_DE_PRUEBA"
```

Si se ejecuta la coleccion desde consola, recordar que el registro crea un usuario de prueba. Se puede limpiar despues con:

```powershell
psql "postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/taller_api" -c "DELETE FROM usuarios WHERE usuario ~ '^usuario_[0-9]+$';"
```
