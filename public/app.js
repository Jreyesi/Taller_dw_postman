const CLAVE_TOKEN = 'biblioteca_token';
const CLAVE_USUARIO = 'biblioteca_usuario';

const estado = {
  token: '',
  usuario: '',
  libros: [],
  editandoId: null
};

const elementos = {};
let temporizadorMensaje = null;

document.addEventListener('DOMContentLoaded', iniciar);

function iniciar() {
  elementos.vistaLogin = document.getElementById('vista-login');
  elementos.vistaApp = document.getElementById('vista-app');
  elementos.sesion = document.getElementById('sesion');
  elementos.usuarioActivo = document.getElementById('usuario-activo');
  elementos.btnSalir = document.getElementById('btn-salir');

  elementos.formLogin = document.getElementById('form-login');
  elementos.loginUsuario = document.getElementById('login-usuario');
  elementos.loginPassword = document.getElementById('login-password');
  elementos.btnLogin = document.getElementById('btn-login');
  elementos.loginError = document.getElementById('login-error');

  elementos.tituloAcceso = document.getElementById('titulo-acceso');
  elementos.ayudaAcceso = document.getElementById('ayuda-acceso');
  elementos.alternativaRegistro = document.getElementById('alternativa-registro');
  elementos.btnMostrarRegistro = document.getElementById('btn-mostrar-registro');
  elementos.formRegistro = document.getElementById('form-registro');
  elementos.registroUsuario = document.getElementById('registro-usuario');
  elementos.registroPassword = document.getElementById('registro-password');
  elementos.registroConfirmar = document.getElementById('registro-confirmar');
  elementos.btnRegistrar = document.getElementById('btn-registrar');
  elementos.btnVolverLogin = document.getElementById('btn-volver-login');
  elementos.registroError = document.getElementById('registro-error');

  elementos.formLibro = document.getElementById('form-libro');
  elementos.formTitulo = document.getElementById('form-titulo');
  elementos.libroId = document.getElementById('libro-id');
  elementos.libroTitulo = document.getElementById('libro-titulo');
  elementos.libroAutor = document.getElementById('libro-autor');
  elementos.libroAnio = document.getElementById('libro-anio');
  elementos.btnGuardar = document.getElementById('btn-guardar');
  elementos.btnCancelar = document.getElementById('btn-cancelar');

  elementos.filtro = document.getElementById('filtro');
  elementos.btnRecargar = document.getElementById('btn-recargar');
  elementos.contador = document.getElementById('contador');
  elementos.mensaje = document.getElementById('mensaje');
  elementos.listaLibros = document.getElementById('lista-libros');

  elementos.libroAnio.max = String(new Date().getFullYear() + 1);

  elementos.formLogin.addEventListener('submit', manejarLogin);
  elementos.formRegistro.addEventListener('submit', manejarRegistro);
  elementos.btnMostrarRegistro.addEventListener('click', () => {
    mostrarFormularioRegistro();
    elementos.registroUsuario.focus();
  });
  elementos.btnVolverLogin.addEventListener('click', () => {
    mostrarFormularioLogin();
    elementos.loginPassword.focus();
  });
  elementos.formLibro.addEventListener('submit', manejarGuardar);
  elementos.btnCancelar.addEventListener('click', limpiarFormulario);
  elementos.btnRecargar.addEventListener('click', cargarLibros);
  elementos.btnSalir.addEventListener('click', cerrarSesion);
  elementos.filtro.addEventListener('input', renderizarLibros);

  estado.token = sessionStorage.getItem(CLAVE_TOKEN) || '';
  estado.usuario = sessionStorage.getItem(CLAVE_USUARIO) || '';

  if (estado.token && estado.usuario) {
    mostrarAplicacion();
    cargarLibros();
  } else {
    if (estado.token || estado.usuario) {
      estado.token = '';
      estado.usuario = '';
      sessionStorage.removeItem(CLAVE_TOKEN);
      sessionStorage.removeItem(CLAVE_USUARIO);
    }
    mostrarLogin();
  }
}

async function api(ruta, opciones = {}) {
  const metodo = opciones.metodo || 'GET';
  const conToken = opciones.conToken !== false;
  const cabeceras = {};

  if (opciones.cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }

  if (conToken) {
    if (!estado.token) {
      finalizarSesion('Debes iniciar sesion para continuar.', 'info');
      const error = new Error('Sesion requerida.');
      error.sesion = true;
      throw error;
    }
    cabeceras.Authorization = `Bearer ${estado.token}`;
  }

  let respuesta;

  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
    });
  } catch {
    throw new Error('No se pudo conectar con la API. Verifica que el servidor este en ejecucion.');
  }

  const texto = await respuesta.text();
  let datos = null;

  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && conToken) {
      finalizarSesion('Tu sesion expiro o el token no es valido. Inicia sesion nuevamente.', 'info');
      const error = new Error('Sesion expirada.');
      error.sesion = true;
      throw error;
    }

    const mensaje = datos && datos.message ? datos.message : `Error HTTP ${respuesta.status}.`;
    const detalles = datos && Array.isArray(datos.details) ? ` ${datos.details.join(' ')}` : '';
    const error = new Error(`${mensaje}${detalles}`.trim());
    error.estado = respuesta.status;
    error.datos = datos;
    throw error;
  }

  return datos;
}

async function manejarLogin(evento) {
  evento.preventDefault();
  ocultarMensajeLogin();

  const usuario = elementos.loginUsuario.value.trim();
  const password = elementos.loginPassword.value;

  if (!usuario || !password) {
    mostrarMensajeLogin('Escribe el usuario y la contrasena.', 'error');
    return;
  }

  bloquearLogin(true);

  try {
    const datos = await api('/auth/login', {
      metodo: 'POST',
      conToken: false,
      cuerpo: { usuario, password }
    });

    estado.token = datos.token;
    estado.usuario = datos.usuario;
    sessionStorage.setItem(CLAVE_TOKEN, datos.token);
    sessionStorage.setItem(CLAVE_USUARIO, datos.usuario);

    elementos.formLogin.reset();
    mostrarAplicacion();
    await cargarLibros();
    mostrarMensaje(`Sesion iniciada como ${datos.usuario}.`, 'ok');
  } catch (error) {
    mostrarMensajeLogin(error.message, 'error');
  } finally {
    bloquearLogin(false);
  }
}

function cerrarSesion() {
  if (estado.token && !window.confirm('Quieres cerrar la sesion actual?')) {
    return;
  }
  finalizarSesion('Sesion cerrada.', 'info');
}

async function manejarRegistro(evento) {
  evento.preventDefault();
  ocultarMensajeRegistro();

  const usuario = elementos.registroUsuario.value.trim().toLowerCase();
  const password = elementos.registroPassword.value;
  const confirmar = elementos.registroConfirmar.value;

  if (!/^[a-z0-9._-]{3,50}$/.test(usuario)) {
    mostrarMensajeRegistro('El usuario debe tener entre 3 y 50 caracteres y solo puede contener letras, numeros, punto, guion o guion bajo.', 'error');
    return;
  }

  if (password.length < 8) {
    mostrarMensajeRegistro('La contrasena debe tener al menos 8 caracteres.', 'error');
    return;
  }

  if (password !== confirmar) {
    mostrarMensajeRegistro('Las contrasenas no coinciden.', 'error');
    return;
  }

  bloquearRegistro(true);

  try {
    await api('/auth/register', {
      metodo: 'POST',
      conToken: false,
      cuerpo: { usuario, password }
    });
  } catch (error) {
    mostrarMensajeRegistro(error.message, 'error');
    bloquearRegistro(false);
    return;
  }

  try {
    const datos = await api('/auth/login', {
      metodo: 'POST',
      conToken: false,
      cuerpo: { usuario, password }
    });

    estado.token = datos.token;
    estado.usuario = datos.usuario;
    sessionStorage.setItem(CLAVE_TOKEN, datos.token);
    sessionStorage.setItem(CLAVE_USUARIO, datos.usuario);

    elementos.formRegistro.reset();
    mostrarFormularioLogin();
    mostrarAplicacion();
    await cargarLibros();
    mostrarMensaje(`Usuario ${datos.usuario} creado. Sesion iniciada.`, 'ok');
  } catch {
    elementos.formRegistro.reset();
    mostrarFormularioLogin();
    elementos.loginUsuario.value = usuario;
    mostrarMensajeLogin('Usuario creado. Inicia sesion con tus credenciales.', 'ok');
  } finally {
    bloquearRegistro(false);
  }
}

function finalizarSesion(mensaje, tipo) {
  estado.token = '';
  estado.usuario = '';
  estado.libros = [];
  estado.editandoId = null;

  sessionStorage.removeItem(CLAVE_TOKEN);
  sessionStorage.removeItem(CLAVE_USUARIO);

  mostrarLogin();
  mostrarMensajeLogin(mensaje, tipo || 'info');
}

function mostrarAplicacion() {
  elementos.vistaLogin.hidden = true;
  elementos.vistaApp.hidden = false;
  elementos.sesion.hidden = false;
  elementos.usuarioActivo.textContent = `Sesion: ${estado.usuario}`;
  ocultarMensajeLogin();
}

function mostrarLogin() {
  elementos.vistaApp.hidden = true;
  elementos.vistaLogin.hidden = false;
  elementos.sesion.hidden = true;
  limpiarFormulario();
  elementos.listaLibros.replaceChildren();
  elementos.filtro.value = '';
  actualizarContador(0, false);
  elementos.mensaje.hidden = true;
  elementos.formRegistro.reset();
  mostrarFormularioLogin();

  window.setTimeout(() => {
    if (!elementos.vistaLogin.hidden) {
      elementos.loginPassword.focus();
    }
  }, 60);
}

function mostrarFormularioLogin() {
  elementos.tituloAcceso.textContent = 'Iniciar sesion';
  elementos.ayudaAcceso.textContent = 'Usa tu cuenta de prueba o crea una cuenta nueva.';
  elementos.formLogin.hidden = false;
  elementos.alternativaRegistro.hidden = false;
  elementos.formRegistro.hidden = true;
  ocultarMensajeLogin();
  ocultarMensajeRegistro();
}

function mostrarFormularioRegistro() {
  elementos.tituloAcceso.textContent = 'Crear usuario';
  elementos.ayudaAcceso.textContent = 'Registra una cuenta nueva. La contrasena se almacena como hash bcrypt.';
  elementos.formLogin.hidden = true;
  elementos.alternativaRegistro.hidden = true;
  elementos.formRegistro.hidden = false;
  ocultarMensajeLogin();
  ocultarMensajeRegistro();
}

async function cargarLibros() {
  if (!estado.token) {
    return;
  }

  elementos.listaLibros.setAttribute('aria-busy', 'true');
  elementos.btnRecargar.disabled = true;
  mostrarCargando();

  try {
    const libros = await api('/libros');
    estado.libros = Array.isArray(libros) ? libros : [];
    renderizarLibros();
  } catch (error) {
    if (!error.sesion) {
      mostrarMensaje(error.message, 'error');
      mostrarEstadoVacio('No se pudieron cargar los libros.', 'Revisa la conexion y vuelve a intentar.');
    }
  } finally {
    elementos.listaLibros.setAttribute('aria-busy', 'false');
    elementos.btnRecargar.disabled = false;
  }
}

function renderizarLibros() {
  const termino = normalizar(elementos.filtro.value.trim());
  const libros = estado.libros.filter((libro) => {
    const contenido = normalizar(`${libro.titulo} ${libro.autor}`);
    return contenido.includes(termino);
  });

  actualizarContador(libros.length, termino !== '');
  elementos.listaLibros.replaceChildren();

  if (libros.length === 0) {
    if (estado.libros.length === 0) {
      mostrarEstadoVacio('La biblioteca esta vacia.', 'Crea el primer libro con el formulario.');
    } else {
      mostrarEstadoVacio('No hay coincidencias.', 'Prueba con otro titulo o autor.');
    }
    return;
  }

  const fragmento = document.createDocumentFragment();

  for (const libro of libros) {
    fragmento.appendChild(crearTarjetaLibro(libro));
  }

  elementos.listaLibros.appendChild(fragmento);
}

function crearTarjetaLibro(libro) {
  const articulo = document.createElement('article');
  articulo.className = 'libro';

  const titulo = document.createElement('h4');
  titulo.textContent = libro.titulo;

  const autor = document.createElement('p');
  autor.className = 'autor';
  autor.textContent = libro.autor;

  const detalle = document.createElement('p');
  detalle.className = 'detalle';
  detalle.textContent = `ID ${libro.id} | Actualizado: ${formatearFecha(libro.actualizado_en)}`;

  const ficha = document.createElement('div');
  ficha.className = 'ficha';

  const anio = document.createElement('span');
  anio.className = 'etiqueta';
  anio.textContent = String(libro.anio);

  const acciones = document.createElement('div');
  acciones.className = 'acciones';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'btn btn-secundario btn-pequeno';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', () => prepararEdicion(libro));

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-peligro btn-pequeno';
  btnEliminar.textContent = 'Eliminar';
  btnEliminar.addEventListener('click', () => eliminarLibro(libro, btnEliminar));

  acciones.append(btnEditar, btnEliminar);
  ficha.append(anio, acciones);
  articulo.append(titulo, autor, detalle, ficha);

  return articulo;
}

function prepararEdicion(libro) {
  estado.editandoId = libro.id;
  elementos.libroId.value = String(libro.id);
  elementos.libroTitulo.value = libro.titulo;
  elementos.libroAutor.value = libro.autor;
  elementos.libroAnio.value = String(libro.anio);
  elementos.formTitulo.textContent = `Editar libro #${libro.id}`;
  elementos.btnGuardar.textContent = 'Guardar cambios';
  elementos.btnCancelar.hidden = false;
  elementos.libroTitulo.focus();
}

async function manejarGuardar(evento) {
  evento.preventDefault();

  if (!elementos.formLibro.reportValidity()) {
    return;
  }

  const titulo = elementos.libroTitulo.value.trim();
  const autor = elementos.libroAutor.value.trim();
  const anio = Number(elementos.libroAnio.value);

  if (!titulo || !autor) {
    mostrarMensaje('Titulo y autor son obligatorios.', 'error');
    return;
  }

  if (!Number.isInteger(anio) || anio < 1) {
    mostrarMensaje('El anio debe ser un entero positivo.', 'error');
    return;
  }

  const editando = estado.editandoId !== null;
  const ruta = editando ? `/libros/${estado.editandoId}` : '/libros';
  const metodo = editando ? 'PUT' : 'POST';

  bloquearFormulario(true);

  try {
    const libro = await api(ruta, {
      metodo,
      cuerpo: { titulo, autor, anio }
    });

    limpiarFormulario();
    await cargarLibros();
    mostrarMensaje(
      editando
        ? `Libro #${libro.id} actualizado correctamente.`
        : `Libro #${libro.id} creado correctamente.`,
      'ok'
    );
  } catch (error) {
    if (!error.sesion) {
      mostrarMensaje(error.message, 'error');
    }

    if (error.estado === 404) {
      limpiarFormulario();
      await cargarLibros();
    }
  } finally {
    bloquearFormulario(false);
  }
}

async function eliminarLibro(libro, boton) {
  const confirmado = window.confirm(`Eliminar el libro "${libro.titulo}"? Esta accion no se puede deshacer.`);

  if (!confirmado) {
    return;
  }

  boton.disabled = true;

  try {
    await api(`/libros/${libro.id}`, { metodo: 'DELETE' });

    if (estado.editandoId === libro.id) {
      limpiarFormulario();
    }

    await cargarLibros();
    mostrarMensaje(`Libro #${libro.id} eliminado correctamente.`, 'ok');
  } catch (error) {
    if (!error.sesion) {
      mostrarMensaje(error.message, 'error');
    }

    if (error.estado === 404) {
      await cargarLibros();
    }
  } finally {
    boton.disabled = false;
  }
}

function limpiarFormulario() {
  estado.editandoId = null;
  elementos.formLibro.reset();
  elementos.libroId.value = '';
  elementos.formTitulo.textContent = 'Nuevo libro';
  elementos.btnGuardar.textContent = 'Crear libro';
  elementos.btnCancelar.hidden = true;
}

function bloquearFormulario(bloqueado) {
  elementos.btnGuardar.disabled = bloqueado;
  elementos.btnCancelar.disabled = bloqueado;
}

function bloquearLogin(bloqueado) {
  elementos.btnLogin.disabled = bloqueado;
  elementos.btnLogin.textContent = bloqueado ? 'Verificando...' : 'Entrar';
}

function bloquearRegistro(bloqueado) {
  elementos.btnRegistrar.disabled = bloqueado;
  elementos.btnRegistrar.textContent = bloqueado ? 'Creando usuario...' : 'Crear usuario e ingresar';
}

function mostrarCargando() {
  const contenedor = document.createElement('div');
  contenedor.className = 'cargando';
  contenedor.textContent = 'Cargando libros...';
  elementos.listaLibros.replaceChildren(contenedor);
}

function mostrarEstadoVacio(titulo, texto) {
  const contenedor = document.createElement('div');
  contenedor.className = 'vacio';

  const encabezado = document.createElement('strong');
  encabezado.textContent = titulo;

  const parrafo = document.createElement('p');
  parrafo.textContent = texto;

  contenedor.append(encabezado, parrafo);
  elementos.listaLibros.replaceChildren(contenedor);
}

function actualizarContador(cantidad, filtrando) {
  const total = estado.libros.length;

  if (filtrando) {
    elementos.contador.textContent = `${cantidad} de ${total} libro${total === 1 ? '' : 's'}`;
  } else {
    elementos.contador.textContent = `${total} libro${total === 1 ? '' : 's'}`;
  }
}

function mostrarMensaje(texto, tipo) {
  window.clearTimeout(temporizadorMensaje);
  elementos.mensaje.textContent = texto;
  elementos.mensaje.className = `mensaje ${tipo || 'ok'}`;
  elementos.mensaje.hidden = false;

  temporizadorMensaje = window.setTimeout(() => {
    elementos.mensaje.hidden = true;
  }, tipo === 'error' ? 8000 : 4500);
}

function mostrarMensajeLogin(texto, tipo) {
  elementos.loginError.textContent = texto;
  elementos.loginError.className = `mensaje ${tipo || 'error'}`;
  elementos.loginError.hidden = false;
}

function ocultarMensajeLogin() {
  elementos.loginError.textContent = '';
  elementos.loginError.hidden = true;
}

function mostrarMensajeRegistro(texto, tipo) {
  elementos.registroError.textContent = texto;
  elementos.registroError.className = `mensaje ${tipo || 'error'}`;
  elementos.registroError.hidden = false;
}

function ocultarMensajeRegistro() {
  elementos.registroError.textContent = '';
  elementos.registroError.hidden = true;
}

function formatearFecha(valor) {
  if (!valor) {
    return 'sin fecha';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'sin fecha';
  }

  return fecha.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
