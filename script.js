// --- CONFIGURACIÓN MEJORADA DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyD04XNtsa6sSGf3e2n9ma9TVysRYaYZE44",
    authDomain: "sistemainventariojpa.firebaseapp.com",
    databaseURL: "https://sistemainventariojpa-default-rtdb.firebaseio.com",
    projectId: "sistemainventariojpa",
    storageBucket: "sistemainventariojpa.appspot.com",
    messagingSenderId: "246809530654",
    appId: "1:246809530654:web:e8b13e432b5311966f390f",
    measurementId: "G-RXCZS2EFZL"
};

let db;
let isCheckingStock = false;
let isCheckingSolicitudes = false;

// Variables para almacenar los gráficos
let chartInstances = {};

// Función para inicializar Firebase
async function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            throw new Error("Firebase no se cargó correctamente. Verifica tu conexión a internet o los scripts en tu HTML.");
        }
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        db = firebase.firestore();
        
        console.log("Firebase inicializado correctamente");
        return true;
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
        return false;
    }
}

// Función para seleccionar rol con estilo visual
function selectRole(role) {
    document.querySelectorAll('.role-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (role === 'Usuario') {
        document.querySelector('.role-option:first-child').classList.add('selected');
        document.getElementById('avatar-img').src = "mecanico.gif";
    } else if (role === 'admin') {
        document.querySelector('.role-option:last-child').classList.add('selected');
        document.getElementById('avatar-img').src = "admin.gif";
    }
    
    // Marcar el radio button correspondiente
    document.querySelector(`input[value="${role}"]`).checked = true;
}

// --- FUNCIONES DEL SISTEMA ---
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.querySelector('input[name="role"]:checked').value;

    if (username === '' || password === '') {
        alert('Por favor complete todos los campos.');
        return;
    }

    if ((role === 'admin' && username === 'admin' && password === '1234') ||
        (role === 'Usuario' && username === 'mecanico' && password === '123')) {
        mostrarDashboard(role);
    } else {
        alert('Usuario o contraseña incorrectos.');
    }
}

function mostrarDashboard(role) {
    document.getElementById('login').style.display = 'none';

    if (role === 'admin') {
        document.getElementById('dashboard-admin').style.display = 'block';
        mostrarApartado('');
        actualizarEstadisticas();
    } else {
        document.getElementById('dashboard-mecanico').style.display = 'block';
        cargarStockMecanico();
    }
}

function logout() {
    document.getElementById('dashboard-admin').style.display = 'none';
    document.getElementById('dashboard-mecanico').style.display = 'none';
    document.getElementById('login').style.display = 'flex';

    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // Al hacer logout, reseteamos a la imagen por defecto
    document.getElementById('avatar-img').src = "avatar.png";
    // Deseleccionar los radios para que al recargar la página no estén marcados
    document.querySelectorAll('.role-option').forEach(option => {
        option.classList.remove('selected');
    });
}

function mostrarApartado(nombre) {
    const secciones = document.querySelectorAll('.admin-section');
    secciones.forEach(sec => sec.style.display = 'none');

    // Actualizar navegación activa
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    if (nombre === '') {
        document.querySelector('.nav-link[onclick="mostrarApartado(\'\')"]').classList.add('active');
        document.getElementById('apartado-inicio').style.display = 'block';
        verificarStockBajo();
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
    } else {
        document.querySelector(`.nav-link[onclick="mostrarApartado('${nombre}')"]`).classList.add('active');
        const mostrar = document.getElementById('apartado-' + nombre);
        if (mostrar) mostrar.style.display = 'block';

        if (nombre === 'stock') {
            cargarStockAdmin();
            document.getElementById('buscar-stock').value = '';
        } else if (nombre === 'salida') {
            cargarRepuestosSalida();
            document.getElementById('form-salida').reset();
            document.getElementById('salida-nombre').value = '';
        } else if (nombre === 'inventario') {
            cargarInventarioCompleto();
            document.getElementById('form-agregar-producto').reset();
            document.getElementById('nuevo-producto-fecha').valueAsDate = new Date();
        } else if (nombre === 'entrada') {
            document.getElementById('entrada-fecha').valueAsDate = new Date();
            cargarHistorialEntradas();
            document.getElementById('form-entrada').reset();
} else if (nombre === 'solicitudes') {
    // Reiniciar botones al entrar
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('btn-todas').classList.add('active');
    
    // Cargar solicitudes inmediatamente
    cargarSolicitudesAdmin('todas');

} else if (nombre === 'reportes') {
    // Inicializar reportes si es la primera vez
    if (Object.keys(chartInstances).length === 0) {
        inicializarReportes();
    } else {
        generarReportes(); // Regenerar con datos actualizados
    }
}
    }
}

// Función para actualizar estadísticas en la página de inicio
async function actualizarEstadisticas() {
    if (!db) return;

    try {
        // Total de productos
        const inventarioSnapshot = await db.collection('inventario').get();
        document.getElementById('total-productos').textContent = inventarioSnapshot.size;

        // Productos con stock bajo
        let stockBajoCount = 0;
        inventarioSnapshot.forEach(doc => {
            const item = doc.data();
            if (item.stock <= 5) {
                stockBajoCount++;
            }
        });
        document.getElementById('productos-stock-bajo').textContent = stockBajoCount;

        // Solicitudes pendientes
        const solicitudesSnapshot = await db.collection('solicitudesRepuestos').where('estado', '==', 'Pendiente').get();
        document.getElementById('solicitudes-pendientes').textContent = solicitudesSnapshot.size;

    } catch (error) {
        console.error("Error al actualizar estadísticas:", error);
    }
}

// --- FUNCIONES DE AUTOCOMPLETAR ---
async function autocompletarNombreGenerico(codigoInputId, nombreInputId) {
    const codigoInput = document.getElementById(codigoInputId);
    const nombreInput = document.getElementById(nombreInputId);
    const codigoBusqueda = codigoInput.value.trim().toUpperCase();

    if (codigoBusqueda === '') {
        nombreInput.value = '';
        return;
    }

    if (!db) {
        console.error("Firestore no está inicializado (autocompletarNombreGenerico)");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').where('codigo', '==', codigoBusqueda).limit(1).get();

        if (!querySnapshot.empty) {
            const productoEncontrado = querySnapshot.docs[0].data();
            nombreInput.value = productoEncontrado.nombre;
        } else {
            nombreInput.value = '';
        }
    } catch (error) {
        console.error("Error al autocompletar nombre:", error);
        nombreInput.value = '';
    }
}

function autocompletarNombreEntrada() {
    autocompletarNombreGenerico('entrada-codigo', 'entrada-nombre');
}

function autocompletarNombreSalida() {
    autocompletarNombreGenerico('salida-codigo', 'salida-nombre');
}

function autocompletarNombreAgregarProducto() {
    autocompletarNombreGenerico('nuevo-codigo', 'nuevo-nombre');
}

// === Inverso: nombre → código ===
function autocompletarCodigoEntrada() {
    autocompletarCodigoGenerico('entrada-nombre', 'entrada-codigo');
}
function autocompletarCodigoSalida() {
    autocompletarCodigoGenerico('salida-nombre', 'salida-codigo');
}
function autocompletarCodigoSolicitud() {
    autocompletarCodigoGenerico('solicitar-nombre', 'solicitar-codigo');
}

// --- AUTOCOMPLETADO INVERSO (NOMBRE → CÓDIGO) ---
async function autocompletarCodigoGenerico(nombreInputId, codigoInputId) {
    const nombreInput = document.getElementById(nombreInputId);
    const codigoInput = document.getElementById(codigoInputId);
    const nombreBusqueda = nombreInput.value.trim().toUpperCase();

    if (nombreBusqueda === '') {
        codigoInput.value = '';
        return;
    }

    if (!db) {
        console.error("Firestore no está inicializado (autocompletarCodigoGenerico)");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').where('nombre', '==', nombreBusqueda).limit(1).get();
        if (!querySnapshot.empty) {
            const productoEncontrado = querySnapshot.docs[0].data();
            codigoInput.value = productoEncontrado.codigo;
        } else {
            codigoInput.value = '';
        }
    } catch (error) {
        console.error("Error al autocompletar código:", error);
        codigoInput.value = '';
    }
}

let debounceEntradaTimer = null;

async function sugerirNombresEntrada() {
    const input = document.getElementById('entrada-nombre');
    const cont = document.getElementById('entrada-nombre-sugerencias');
    if (!input || !cont) return;
    const term = input.value.trim().toUpperCase();
    if (debounceEntradaTimer) clearTimeout(debounceEntradaTimer);
    debounceEntradaTimer = setTimeout(async () => {
        if (term === '') { cont.innerHTML = ''; cont.style.display = 'none'; return; }
        if (!db) { console.error('Firestore no está inicializado (sugerirNombresEntrada)'); return; }
        try {
            const start = term;
            const end = term + '\uf8ff';
            const snap = await db.collection('inventario')
                .orderBy('nombre')
                .startAt(start)
                .endAt(end)
                .limit(8)
                .get();
            const resultados = [];
            snap.forEach(doc => { const d = doc.data(); resultados.push({ nombre: d.nombre, codigo: d.codigo }); });
            renderSugerenciasEntrada(resultados);
        } catch (e) {
            console.error('Error cargando sugerencias (entrada):', e);
            cont.innerHTML = ''; cont.style.display = 'none';
        }
    }, 200);
}

function renderSugerenciasEntrada(items) {
    const input = document.getElementById('entrada-nombre');
    const codigo = document.getElementById('entrada-codigo');
    const cont = document.getElementById('entrada-nombre-sugerencias');
    if (!input || !codigo || !cont) return;
    if (!items || items.length === 0) { cont.innerHTML = ''; cont.style.display = 'none'; return; }
    cont.innerHTML = '';
    items.forEach(({ nombre, codigo: cod }) => {
        const el = document.createElement('div');
        el.className = 'autocomplete-item';
        el.textContent = `${nombre} (${cod})`;
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            input.value = nombre;
            codigo.value = cod;
            cont.style.display = 'none';
        });
        cont.appendChild(el);
    });
    const rect = input.getBoundingClientRect();
    cont.style.minWidth = rect.width + 'px';
    cont.style.display = 'block';
}

// === Sugerencias por nombre en Solicitud (Mecánico) ===
let debounceSolicitudTimer = null;
async function sugerirNombresSolicitud() {
    const input = document.getElementById('solicitar-nombre');
    const cont = document.getElementById('solicitar-nombre-sugerencias');
    if (!input || !cont) return;
    const term = input.value.trim().toUpperCase();
    if (debounceSolicitudTimer) clearTimeout(debounceSolicitudTimer);
    debounceSolicitudTimer = setTimeout(async () => {
        if (term === '') { cont.innerHTML = ''; cont.style.display = 'none'; return; }
        if (!db) { console.error('Firestore no está inicializado (sugerirNombresSolicitud)'); return; }
        try {
            const start = term;
            const end = term + '\uf8ff';
            const snap = await db.collection('inventario')
                .orderBy('nombre')
                .startAt(start)
                .endAt(end)
                .limit(8)
                .get();
            const resultados = [];
            snap.forEach(doc => { const d = doc.data(); resultados.push({ nombre: d.nombre, codigo: d.codigo }); });
            renderSugerenciasSolicitud(resultados);
        } catch (e) {
            console.error('Error cargando sugerencias (solicitud):', e);
            cont.innerHTML = ''; cont.style.display = 'none';
        }
    }, 200);
}

function renderSugerenciasSolicitud(items) {
    const cont = document.getElementById('solicitar-nombre-sugerencias');
    if (!cont) return;
    if (!items || items.length === 0) { cont.innerHTML = ''; cont.style.display = 'none'; return; }
    cont.innerHTML = '';
    items.forEach(it => {
        const el = document.createElement('div');
        el.className = 'autocomplete-item';
        el.textContent = `${it.nombre} — ${it.codigo}`;
        el.onmousedown = (e) => {
            e.preventDefault();
            const nombreEl = document.getElementById('solicitar-nombre');
            const codigoEl = document.getElementById('solicitar-codigo');
            if (nombreEl) nombreEl.value = it.nombre;
            if (codigoEl) codigoEl.value = it.codigo;
            cont.innerHTML = ''; cont.style.display = 'none';
        };
        el.addEventListener('click', () => {
            const nombreEl = document.getElementById('solicitar-nombre');
            const codigoEl = document.getElementById('solicitar-codigo');
            if (nombreEl) nombreEl.value = it.nombre;
            if (codigoEl) codigoEl.value = it.codigo;
            cont.innerHTML = ''; cont.style.display = 'none';
        });
        cont.appendChild(el);
    });
    cont.style.display = 'block';
}

// === Sugerencias por nombre en Salidas ===
let debounceSalidaTimer = null;

async function sugerirNombresSalida() {
    // ... rest of the code remains the same ...
    const input = document.getElementById('salida-nombre');
    const cont = document.getElementById('salida-nombre-sugerencias');
    if (!input || !cont) return;
    const term = input.value.trim().toUpperCase();
    if (debounceSalidaTimer) clearTimeout(debounceSalidaTimer);
    debounceSalidaTimer = setTimeout(async () => {
        if (term === '') { cont.innerHTML = ''; cont.style.display = 'none'; return; }
        if (!db) { console.error('Firestore no está inicializado (sugerirNombresSalida)'); return; }
        try {
            const start = term;
            const end = term + '\uf8ff';
            const snap = await db.collection('inventario')
                .orderBy('nombre')
                .startAt(start)
                .endAt(end)
                .limit(8)
                .get();
            const resultados = [];
            snap.forEach(doc => { const d = doc.data(); resultados.push({ nombre: d.nombre, codigo: d.codigo }); });
            renderSugerenciasSalida(resultados);
        } catch (e) {
            console.error('Error cargando sugerencias (salida):', e);
            cont.innerHTML = ''; cont.style.display = 'none';
        }
    }, 200);
}

function renderSugerenciasSalida(items) {
    const cont = document.getElementById('salida-nombre-sugerencias');
    if (!cont) return;
    if (!items || items.length === 0) { cont.innerHTML = ''; cont.style.display = 'none'; return; }
    cont.innerHTML = '';
    items.forEach(it => {
        const el = document.createElement('div');
        el.className = 'autocomplete-item';
        el.textContent = `${it.nombre} — ${it.codigo}`;
        el.onmousedown = (e) => {
            e.preventDefault();
            const nombreEl = document.getElementById('salida-nombre');
            const codigoEl = document.getElementById('salida-codigo');
            if (nombreEl) nombreEl.value = it.nombre;
            if (codigoEl) codigoEl.value = it.codigo;
            cont.innerHTML = ''; cont.style.display = 'none';
        };
        el.addEventListener('click', () => {
            const nombreEl = document.getElementById('salida-nombre');
            const codigoEl = document.getElementById('salida-codigo');
            if (nombreEl) nombreEl.value = it.nombre;
            if (codigoEl) codigoEl.value = it.codigo;
            cont.innerHTML = ''; cont.style.display = 'none';
        });
        cont.appendChild(el);
    });
    cont.style.display = 'block';
}

// ... rest of the code remains the same ...

async function agregarEntrada(event) {
    event.preventDefault();
    const codigo = document.getElementById('entrada-codigo').value.trim().toUpperCase();
    const cantidad = parseInt(document.getElementById('entrada-cantidad').value);
    const fecha = document.getElementById('entrada-fecha').value;

    if (!codigo || isNaN(cantidad) || cantidad <= 0 || !fecha) {
        alert('Por favor complete los campos correctamente.');
        return;
    }

    if (!db) {
        console.error("Firestore no está inicializado (agregarEntrada)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }
    
    try {
        const querySnapshot = await db.collection('inventario').where('codigo', '==', codigo).get();
        
        if (querySnapshot.empty) {
            alert('Producto no encontrado. Use "Inventario Completo" para añadir nuevos ítems.');
            return;
        }

        const productoDoc = querySnapshot.docs[0];
        const productoData = productoDoc.data();

        await db.collection('inventario').doc(productoDoc.id).update({
            stock: firebase.firestore.FieldValue.increment(cantidad),
            fechaActualizacion: fecha
        });
        
        await db.collection('historialEntradas').add({
            fecha: fecha,
            codigo: codigo,
            nombre: productoData.nombre,
            cantidad: cantidad
        });

        alert(`Entrada registrada: ${cantidad} unidades de ${productoData.nombre}`);
        document.getElementById('form-entrada').reset();
        document.getElementById('entrada-fecha').valueAsDate = new Date();
        cargarInventarioCompleto();
        cargarHistorialEntradas();
        verificarStockBajo();
        actualizarEstadisticas();
        
    } catch(error) {
        console.error("Error al registrar entrada: ", error);
        alert("Hubo un error al registrar la entrada.");
    }
}

async function agregarSalida(event) {
    event.preventDefault();
    const codigo = document.getElementById('salida-codigo').value.trim().toUpperCase();
    const cantidad = parseInt(document.getElementById('salida-cantidad').value);
    const cliente = document.getElementById('salida-cliente').value.trim();
    const numeroOT = document.getElementById('salida-numero-ot').value.trim();
    const placa = document.getElementById('salida-placa').value.trim();
    const kilometraje = document.getElementById('salida-kilometraje').value || 0;

    if (!codigo || isNaN(cantidad) || cantidad <= 0 || !cliente || !numeroOT) {
        alert('Por favor complete código, cantidad, cliente y Número OT correctamente.');
        return;
    }

    if (!db) {
        console.error("Firestore no está inicializado (agregarSalida)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').where('codigo', '==', codigo).get();

        if (querySnapshot.empty) {
            alert('El producto no existe en inventario.');
            return;
        }

        const productoDoc = querySnapshot.docs[0];
        const productoData = productoDoc.data();

        if (productoData.stock < cantidad) {
            alert(`Stock insuficiente. Stock actual de ${productoData.nombre}: ${productoData.stock}`);
            return;
        }
        
        const fechaSalida = new Date().toISOString().slice(0, 10);

        await db.collection('inventario').doc(productoDoc.id).update({
            stock: firebase.firestore.FieldValue.increment(-cantidad),
            fechaActualizacion: fechaSalida
        });
        
        await db.collection('repuestosSalida').add({
            fecha: fechaSalida,
            repuesto: productoData.nombre,
            cliente: cliente,
            numeroOT: numeroOT,
            cantidad: cantidad,
            placa: placa,
            kilometraje: kilometraje
        });

        alert(`Salida registrada: ${cantidad} unidades de ${productoData.nombre}`);
        document.getElementById('form-salida').reset();
        cargarRepuestosSalida();
        cargarInventarioCompleto();
        verificarStockBajo();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("Error al registrar salida: ", error);
        alert("Hubo un error al registrar la salida.");
    }
}

// --- FUNCIÓN DE SOLICITUD DE MECÁNICO ---
async function solicitarRepuesto(event) {
    event.preventDefault();
    
    const codigo = document.getElementById('solicitar-codigo').value.trim().toUpperCase();
    const nombre = document.getElementById('solicitar-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('solicitar-cantidad').value);
    const usuarioMecanico = 'mecanico';

    if (!codigo || !nombre || isNaN(cantidad) || cantidad <= 0) {
        alert('Por favor, complete todos los campos correctamente.');
        return;
    }

    if (!db) {
        console.error("Firestore no está inicializado (solicitarRepuesto)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        await db.collection('solicitudesRepuestos').add({
            fecha: new Date().toISOString().slice(0, 10),
            mecanico: usuarioMecanico,
            codigo: codigo,
            repuesto: nombre,
            cantidad: cantidad,
            estado: 'Pendiente'
        });

        alert(`Su solicitud de ${cantidad} unidades de ${nombre} ha sido enviada al administrador.`);
        document.getElementById('form-solicitar-repuesto').reset();
        const formSol = document.getElementById('form-solicitar-repuesto');
        if (formSol) {
            const note = document.createElement('div');
            note.textContent = `Solicitud enviada: ${cantidad} de ${nombre}`;
            note.style.background = '#e6ffed';
            note.style.border = '1px solid #34c759';
            note.style.color = '#0b5d1e';
            note.style.padding = '10px 12px';
            note.style.borderRadius = '6px';
            note.style.marginTop = '10px';
            note.style.fontWeight = '600';
            formSol.appendChild(note);
            setTimeout(() => { if (note && note.parentNode) note.parentNode.removeChild(note); }, 3000);
        }
        
    } catch (error) {
        console.error("Error al registrar la solicitud:", error);
        alert("Hubo un error al enviar la solicitud.");
    }
}

// Fallback global: asegura que el formulario de Solicitar Repuesto dispare la acción
document.addEventListener('submit', function(e) {
    const target = e.target;
    if (target && target.id === 'form-solicitar-repuesto') {
        e.preventDefault();
        solicitarRepuesto(e);
        // Confirmación visible extra por si el alert se bloquea
        // Nota: el alert principal ya se muestra dentro de solicitarRepuesto si todo va bien
    }
}, true);

// Función para autocompletar nombre en solicitud de repuesto
function autocompletarNombreSolicitud() {
    autocompletarNombreGenerico('solicitar-codigo', 'solicitar-nombre');
}

// --- FUNCIONES DEL ADMINISTRADOR PARA SOLICITUDES ---
async function cargarSolicitudesAdmin() {
    const tbody = document.querySelector('#tabla-solicitudes tbody');
    const filtro = document.getElementById('filtro-solicitudes').value;
    
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    
    if (!db) {
        tbody.innerHTML = '<tr><td colspan="6">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarSolicitudesAdmin)");
        return;
    }

    try {
        let query = db.collection('solicitudesRepuestos').orderBy('fecha', 'desc');
        
        // Aplicar filtro según selección - CORREGIDO
        if (filtro === 'pendientes') {
            query = query.where('estado', '==', 'Pendiente');
        } else if (filtro === 'aceptadas') {
            query = query.where('estado', '==', 'Aceptada');
        } else if (filtro === 'rechazadas') {
            // Para filtrar múltiples estados de rechazo
            query = query.where('estado', 'in', ['Rechazada', 'Rechazada - No Existe', 'Rechazada - Stock Insuficiente']);
        }
        // Para "todas" no aplicamos ningún filtro where
        
        const querySnapshot = await query.get();
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6">No hay solicitudes ${obtenerTextoFiltro(filtro)}.</td></tr>`;
            return;
        }

        querySnapshot.forEach(doc => {
            const solicitud = doc.data();
            const docId = doc.id;
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>${solicitud.fecha}</td>
                <td>${solicitud.mecanico}</td>
                <td>${solicitud.repuesto}</td>
                <td>${solicitud.cantidad}</td>
                <td><span class="estado-${solicitud.estado.toLowerCase().replace(/ /g, '-')}">${solicitud.estado}</span></td>
                <td class="action-buttons-table">
                    ${solicitud.estado === 'Pendiente' ? 
                    `<button class="btn-icon btn-icon-accept" onclick="aceptarSolicitud('${docId}', '${solicitud.repuesto}', ${solicitud.cantidad})" title="Aceptar solicitud">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-icon btn-icon-reject" onclick="rechazarSolicitud('${docId}')" title="Rechazar solicitud">
                        <i class="fas fa-times"></i>
                    </button>` : 
                    `<button class="btn-icon btn-icon-delete" onclick="eliminarSolicitudIndividual('${docId}')" title="Eliminar solicitud">
                        <i class="fas fa-trash"></i>
                    </button>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error("Error al cargar solicitudes:", error);
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar datos.</td></tr>';
    }
}

// --- FUNCIONES DE CARGA DE TABLAS ---
async function cargarStockAdmin() {
    const tbody = document.querySelector('#tabla-stock-admin tbody');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    if (!db) {
        tbody.innerHTML = '<tr><td colspan="6">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarStockAdmin)");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').orderBy('nombre').get();
        tbody.innerHTML = '';

        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6">No hay productos.</td></tr>';
            return;
        }

        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.fechaActualizacion || 'N/A'}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.stock}</td>
                <td>S/ ${parseFloat(item.costoUnitario).toFixed(2)}</td>
                <td>S/ ${parseFloat(item.precioVenta).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar stock del administrador: ", error);
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar datos.</td></tr>';
    }
}

async function cargarRepuestosSalida() {
    const tbody = document.querySelector('#tabla-salida tbody');
    tbody.innerHTML = '<tr><td colspan="8">Cargando...</td></tr>';
    
    if (!db) {
        tbody.innerHTML = '<tr><td colspan="8">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarRepuestosSalida)");
        return;
    }

    try {
        const querySnapshot = await db.collection('repuestosSalida').orderBy('fecha', 'desc').get();
        tbody.innerHTML = '';
        
        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8">No hay salidas registradas.</td></tr>';
            return;
        }

        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.fecha}</td>
                <td>${item.repuesto}</td>
                <td>${item.cliente}</td>
                <td>${item.numeroOT}</td>
                <td>${item.cantidad}</td>
                <td>${item.placa}</td>
                <td>${item.kilometraje}</td>
                <td class="action-buttons-table">
                    <button class="btn-icon btn-icon-edit" onclick="actualizarSalida('${doc.id}')" title="Actualizar salida">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-icon-delete" onclick="eliminarSalida('${doc.id}', '${item.repuesto}', ${item.cantidad})" title="Eliminar salida">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar repuestos de salida: ", error);
        tbody.innerHTML = '<tr><td colspan="8">Error al cargar datos.</td></tr>';
    }
}

// Función para cargar historial de entradas con iconos
async function cargarHistorialEntradas() {
    const tbody = document.querySelector('#tabla-entradas-historial tbody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading">Cargando entradas...</div></td></tr>';

    if (!db) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="error-message">Error: Firestore no está inicializado</div></td></tr>';
        return;
    }

    try {
        const querySnapshot = await db.collection('historialEntradas').orderBy('fecha', 'desc').get();
        
        if(querySnapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px;">
                        <i class="fas fa-inbox" style="font-size: 48px; color: #bdc3c7; margin-bottom: 10px;"></i>
                        <div style="color: #7f8c8d;">No hay entradas registradas</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            
            // Crear botones de forma más explícita
            const editButton = document.createElement('button');
            editButton.className = 'btn-icon btn-icon-edit';
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Actualizar entrada';
            editButton.onclick = () => actualizarEntrada(doc.id);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-icon btn-icon-delete';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'Eliminar entrada';
            deleteButton.onclick = () => eliminarEntrada(doc.id, item.codigo, item.nombre, item.cantidad);
            
            const actionsCell = document.createElement('td');
            actionsCell.className = 'action-buttons-table';
            actionsCell.appendChild(editButton);
            actionsCell.appendChild(deleteButton);
            
            tr.innerHTML = `
                <td>${item.fecha}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
            `;
            tr.appendChild(actionsCell);
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar historial de entradas: ", error);
        tbody.innerHTML = '<tr><td colspan="5"><div class="error-message">Error al cargar datos</div></td></tr>';
    }
}

async function cargarInventarioCompleto() {
    const tbody = document.querySelector('#tabla-inventario tbody');
    tbody.innerHTML = '<tr><td colspan="8">Cargando...</td></tr>';
    
    if (!db) {
        tbody.innerHTML = '<tr><td colspan="8">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarInventarioCompleto)");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').orderBy('nombre').get();
        tbody.innerHTML = '';

        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8">No hay productos.</td></tr>';
            return;
        }
        
        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.fechaActualizacion || 'N/A'}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.lote || 'N/A'}</td>
                <td>S/ ${parseFloat(item.costoUnitario).toFixed(2)}</td>
                <td>S/ ${parseFloat(item.precioVenta).toFixed(2)}</td>
                <td>${item.stock}</td>
                <td class="action-buttons-table">
                    <button class="btn-icon btn-icon-edit" onclick="actualizarProducto('${doc.id}')" title="Actualizar producto">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-icon-delete" onclick="eliminarProducto('${doc.id}', '${item.nombre}')" title="Eliminar producto">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar inventario completo: ", error);
        tbody.innerHTML = '<tr><td colspan="8">Error al cargar datos.</td></tr>';
    }
}


async function eliminarProducto(docId, nombre) {
    if (confirm(`¿Estás seguro de que quieres eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`)) {
        if (!db) {
            console.error("Firestore no está inicializado (eliminarProducto)");
            alert("El sistema no está listo. Intente nuevamente.");
            return;
        }
        try {
            await db.collection('inventario').doc(docId).delete();
            alert('Producto eliminado exitosamente.');
            cargarInventarioCompleto();
            verificarStockBajo();
            actualizarEstadisticas();
        } catch (error) {
            console.error("Error al eliminar producto: ", error);
            alert("Hubo un error al eliminar el producto.");
        }
    }
}

async function actualizarProducto(docId) {
    if (!db) {
        console.error("Firestore no está inicializado (actualizarProducto)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }
    try {
        const docRef = db.collection('inventario').doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            alert("El producto que intentas actualizar ya no existe.");
            return;
        }

        const producto = docSnap.data();

        const nuevoNombre = prompt(`Actualizar nombre:`, producto.nombre);
        if (nuevoNombre === null || nuevoNombre.trim() === '') { 
            alert('Actualización cancelada.'); 
            return; 
        }

        const nuevoLote = prompt(`Actualizar lote:`, producto.lote || '');
        if (nuevoLote === null) { 
            alert('Actualización cancelada.'); 
            return; 
        }

        const nuevoCosto = prompt(`Actualizar costo unitario (S/.):`, producto.costoUnitario);
        if (nuevoCosto === null || isNaN(parseFloat(nuevoCosto))) { 
            alert('Actualización cancelada. El costo debe ser un número.'); 
            return; 
        }
        const costoFloat = parseFloat(nuevoCosto);

        const nuevoPrecio = prompt(`Actualizar precio de venta (S/.):`, producto.precioVenta);
        if (nuevoPrecio === null || isNaN(parseFloat(nuevoPrecio))) { 
            alert('Actualización cancelada. El precio debe ser un número.'); 
            return; 
        }
        const precioFloat = parseFloat(nuevoPrecio);

        const nuevoStock = prompt(`Actualizar stock:`, producto.stock);
        if (nuevoStock === null || isNaN(parseInt(nuevoStock))) { 
            alert('Actualización cancelada. El stock debe ser un número entero.'); 
            return; 
        }
        const stockInt = parseInt(nuevoStock);
        
        const fechaActual = new Date().toISOString().slice(0, 10);
        
        await docRef.update({
            nombre: nuevoNombre.trim().toUpperCase(),
            lote: nuevoLote.trim(),
            costoUnitario: costoFloat.toFixed(2),
            precioVenta: precioFloat.toFixed(2),
            stock: stockInt,
            fechaActualizacion: fechaActual
        });
        
        alert(`Producto "${nuevoNombre}" actualizado exitosamente.`);
        cargarInventarioCompleto();
        verificarStockBajo();
        actualizarEstadisticas();
    } catch (error) {
        console.error("Error al actualizar producto: ", error);
        alert("Hubo un error al actualizar el producto.");
    }
}

async function cargarStockMecanico() {
    const tbody = document.querySelector('#tabla-stock tbody');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    if (!db) {
        tbody.innerHTML = '<tr><td colspan="6">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarStockMecanico)");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').orderBy('nombre').get();
        tbody.innerHTML = '';
        
        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6">No hay productos.</td></tr>';
            return;
        }

        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.fechaActualizacion || 'N/A'}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.stock}</td>
                <td>S/ ${parseFloat(item.costoUnitario).toFixed(2)}</td>
                <td>S/ ${parseFloat(item.precioVenta).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar stock del mecánico: ", error);
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar datos.</td></tr>';
    }
}

// Filtros locales
function filtrarStock() {
    const filtro = document.getElementById('buscar-stock').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-stock-admin tbody tr');

    filas.forEach(fila => {
        const nombre = fila.cells[2].textContent.toLowerCase();
        fila.style.display = nombre.includes(filtro) ? '' : 'none';
    });
}

function filtrarRepuestosMecanicoPorNombre() {
    const filtro = document.getElementById('buscar-repuesto-nombre').value.toLowerCase();
    const filas = document.querySelectorAll('#tabla-stock tbody tr');

    filas.forEach(fila => {
        const nombre = fila.cells[2].textContent.toLowerCase();
        fila.style.display = nombre.includes(filtro) ? '' : 'none';
    });
}

async function exportarExcel() {
    alert("Generando reporte... Esto puede tardar unos segundos.");
    
    if (!db) {
        alert("El sistema no está listo para exportar. Intente nuevamente.");
        console.error("Firestore no está inicializado (exportarExcel)");
        return;
    }

    const wb = XLSX.utils.book_new();

    try {
        // 1. Obtener datos de Inventario
        const inventarioSnaptshot = await db.collection('inventario').get();
        const dataInventario = inventarioSnaptshot.docs.map(doc => {
            const item = doc.data();
            return {
                'Fecha Última Actualización': item.fechaActualizacion || 'N/A',
                Codigo: item.codigo,
                Nombre: item.nombre,
                Lote: item.lote || '',
                'Costo Unitario (S/.)': parseFloat(item.costoUnitario).toFixed(2),
                'Precio de Venta (S/.)': parseFloat(item.precioVenta).toFixed(2),
                Stock: item.stock
            };
        });
        const wsInventario = XLSX.utils.json_to_sheet(dataInventario);
        XLSX.utils.book_append_sheet(wb, wsInventario, 'Inventario (Stock)');

        // 2. Obtener datos de Entradas
        const entradasSnapshot = await db.collection('historialEntradas').get();
        const dataEntradas = entradasSnapshot.docs.map(doc => doc.data());
        const wsEntradas = XLSX.utils.json_to_sheet(dataEntradas);
        XLSX.utils.book_append_sheet(wb, wsEntradas, 'Historial de Entradas');

        // 3. Obtener datos de Salidas
        const salidasSnapshot = await db.collection('repuestosSalida').get();
        const dataSalidas = salidasSnapshot.docs.map(doc => doc.data());
        const wsSalidas = XLSX.utils.json_to_sheet(dataSalidas);
        XLSX.utils.book_append_sheet(wb, wsSalidas, 'Historial de Salidas');
        
        // 4. Obtener datos de Solicitudes
        const solicitudesSnapshot = await db.collection('solicitudesRepuestos').get();
        const dataSolicitudes = solicitudesSnapshot.docs.map(doc => doc.data());
        const wsSolicitudes = XLSX.utils.json_to_sheet(dataSolicitudes);
        XLSX.utils.book_append_sheet(wb, wsSolicitudes, 'Historial de Solicitudes');

        // Descargar el archivo
        XLSX.writeFile(wb, 'Reporte_Inventario_Movimientos.xlsx');
        alert("Reporte de Excel generado exitosamente.");

    } catch (error) {
        console.error("Error al exportar a Excel: ", error);
        alert("Hubo un error al generar el reporte de Excel.");
    }
}

// --- FUNCIÓN PARA VERIFICAR STOCK BAJO (AJUSTADA PARA EVITAR DUPLICACIONES) ---
async function verificarStockBajo() {
    if (isCheckingStock) {
        console.log("Ya se está verificando el stock. Ignorando llamada duplicada.");
        return;
    }

    isCheckingStock = true;
    
    const stockLowList = document.getElementById('stock-low-list');
    const notificationContainer = document.getElementById('stock-notification-container');
    
    stockLowList.innerHTML = ''; 
    notificationContainer.style.display = 'none';

    if (!db) {
        console.error("Firestore no está inicializado (verificarStockBajo)");
        isCheckingStock = false;
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').get();
        let productosBajoStock = [];

        querySnapshot.forEach(doc => {
            const item = doc.data();
            if (item.stock <= 5) {
                productosBajoStock.push({
                    nombre: item.nombre,
                    stock: item.stock
                });
            }
        });

        if (productosBajoStock.length > 0) {
            productosBajoStock.forEach(producto => {
                const li = document.createElement('li');
                li.textContent = `- ${producto.nombre} (Stock: ${producto.stock})`;
                stockLowList.appendChild(li);
            });
            notificationContainer.style.display = 'block';
        } else {
            notificationContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("Error al verificar stock bajo:", error);
    } finally {
        isCheckingStock = false;
    }
}

// --- FUNCIÓN PARA VERIFICAR SOLICITUDES PENDIENTES ---
async function verificarSolicitudesPendientes() {
    if (isCheckingSolicitudes) {
        console.log("Ya se están verificando las solicitudes. Ignorando llamada duplicada.");
        return;
    }
    
    isCheckingSolicitudes = true;
    
    const solicitudList = document.getElementById('solicitud-list');
    const notificationContainer = document.getElementById('solicitud-notification-container');
    
    // Limpiar la lista primero
    if (solicitudList) {
        solicitudList.innerHTML = '';
    }
    
    if (notificationContainer) {
        notificationContainer.style.display = 'none';
    }

    if (!db) {
        console.error("Firestore no está inicializado (verificarSolicitudesPendientes)");
        isCheckingSolicitudes = false;
        return;
    }

    try {
        const querySnapshot = await db.collection('solicitudesRepuestos').where('estado', '==', 'Pendiente').get();
        let solicitudesPendientes = [];

        querySnapshot.forEach(doc => {
            const solicitud = doc.data();
            solicitudesPendientes.push({
                repuesto: solicitud.repuesto,
                cantidad: solicitud.cantidad
            });
        });

        if (solicitudesPendientes.length > 0 && solicitudList && notificationContainer) {
            solicitudesPendientes.forEach(solicitud => {
                const li = document.createElement('li');
                li.textContent = `- ${solicitud.repuesto} (Cantidad: ${solicitud.cantidad})`;
                solicitudList.appendChild(li);
            });
            notificationContainer.style.display = 'block';
        } else if (notificationContainer) {
            notificationContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("Error al verificar solicitudes pendientes:", error);
    } finally {
        isCheckingSolicitudes = false;
    }
}

// --- FUNCIONES NUEVAS PARA LA TABLA DE ENTRADAS ---
async function actualizarEntrada(docId) {
    if (!db) {
        console.error("Firestore no está inicializado (actualizarEntrada)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        const docRef = db.collection('historialEntradas').doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            alert("El registro de entrada que intentas actualizar ya no existe.");
            return;
        }
        
        const entrada = docSnap.data();

        // Solicitar nuevos valores para todos los campos
        const nuevaFecha = prompt(`Actualizar fecha (actual: ${entrada.fecha}):`, entrada.fecha);
        if (nuevaFecha === null) {
            alert('Actualización cancelada.');
            return;
        }

        const nuevoCodigo = prompt(`Actualizar código (actual: ${entrada.codigo}):`, entrada.codigo);
        if (nuevoCodigo === null || nuevoCodigo.trim() === '') {
            alert('Actualización cancelada. El código no puede estar vacío.');
            return;
        }

        const nuevoNombre = prompt(`Actualizar producto (actual: ${entrada.nombre}):`, entrada.nombre);
        if (nuevoNombre === null || nuevoNombre.trim() === '') {
            alert('Actualización cancelada. El producto no puede estar vacío.');
            return;
        }

        const nuevaCantidad = prompt(`Actualizar cantidad (actual: ${entrada.cantidad}):`, entrada.cantidad);
        if (nuevaCantidad === null || isNaN(parseInt(nuevaCantidad)) || parseInt(nuevaCantidad) <= 0) {
            alert('Actualización cancelada. La cantidad debe ser un número válido mayor a 0.');
            return;
        }
        const cantidadInt = parseInt(nuevaCantidad);

        // Si cambió el código o el producto, necesitamos verificar el nuevo producto en inventario
        if (nuevoCodigo !== entrada.codigo || nuevoNombre !== entrada.nombre) {
            const nuevoProductoQuery = await db.collection('inventario').where('codigo', '==', nuevoCodigo.trim().toUpperCase()).get();
            
            if (nuevoProductoQuery.empty) {
                alert(`El nuevo código "${nuevoCodigo}" no existe en el inventario.`);
                return;
            }
            
            const nuevoProductoData = nuevoProductoQuery.docs[0].data();
            if (nuevoProductoData.nombre !== nuevoNombre.trim().toUpperCase()) {
                alert(`El nombre del producto no coincide con el código. Producto esperado: ${nuevoProductoData.nombre}`);
                return;
            }
        }

        // Calcular la diferencia para actualizar el inventario
        const diferencia = cantidadInt - entrada.cantidad;

        // Procesar cambios en el inventario
        if (nuevoCodigo !== entrada.codigo || nuevoNombre !== entrada.nombre) {
            // Si cambió el producto, revertir el stock del producto anterior y agregar al nuevo
            const productoAnteriorQuery = await db.collection('inventario').where('codigo', '==', entrada.codigo).limit(1).get();
            if (!productoAnteriorQuery.empty) {
                const productoAnteriorDoc = productoAnteriorQuery.docs[0];
                const productoAnteriorData = productoAnteriorDoc.data();
                
                // Verificar stock suficiente para revertir
                if (productoAnteriorData.stock < entrada.cantidad) {
                    alert(`No se puede cambiar el producto. Stock insuficiente del producto anterior. Stock actual: ${productoAnteriorData.stock}`);
                    return;
                }
                
                // Revertir stock del producto anterior
                await db.collection('inventario').doc(productoAnteriorDoc.id).update({
                    stock: firebase.firestore.FieldValue.increment(-entrada.cantidad)
                });
            }
            
            // Agregar stock al nuevo producto
            const nuevoProductoQuery = await db.collection('inventario').where('codigo', '==', nuevoCodigo.trim().toUpperCase()).limit(1).get();
            if (!nuevoProductoQuery.empty) {
                const nuevoProductoDoc = nuevoProductoQuery.docs[0];
                await db.collection('inventario').doc(nuevoProductoDoc.id).update({
                    stock: firebase.firestore.FieldValue.increment(cantidadInt)
                });
            }
        } else {
            // Si es el mismo producto, solo ajustar la cantidad
            if (diferencia !== 0) {
                const productoQuery = await db.collection('inventario').where('codigo', '==', entrada.codigo).limit(1).get();
                
                if (!productoQuery.empty) {
                    const productoDoc = productoQuery.docs[0];
                    const productoData = productoDoc.data();
                    
                    // Verificar stock suficiente si es una reducción
                    if (diferencia < 0 && productoData.stock < Math.abs(diferencia)) {
                        alert(`Stock insuficiente. Stock actual: ${productoData.stock}. No se puede reducir la cantidad.`);
                        return;
                    }
                    
                    // Actualizar el stock en inventario
                    await db.collection('inventario').doc(productoDoc.id).update({
                        stock: firebase.firestore.FieldValue.increment(diferencia)
                    });
                }
            }
        }
        
        // Actualizar el registro de entrada
        await docRef.update({
            fecha: nuevaFecha.trim(),
            codigo: nuevoCodigo.trim().toUpperCase(),
            nombre: nuevoNombre.trim().toUpperCase(),
            cantidad: cantidadInt
        });
        
        alert(`Entrada actualizada exitosamente.\n\nProducto: ${nuevoNombre}\nCódigo: ${nuevoCodigo}\nCantidad: ${cantidadInt}\nFecha: ${nuevaFecha}`);
        cargarHistorialEntradas();
        cargarInventarioCompleto();
        verificarStockBajo();
        actualizarEstadisticas();

    } catch (error) {
        console.error("Error al actualizar la entrada: ", error);
        alert("Hubo un error al actualizar el registro de entrada.");
    }
}

async function eliminarEntrada(docId, codigoProducto, nombreProducto, cantidad) {
    if (confirm(`¿Estás seguro de que quieres eliminar la entrada de ${cantidad} unidades de "${nombreProducto}"?`)) {
        if (!db) {
            console.error("Firestore no está inicializado (eliminarEntrada)");
            alert("El sistema no está listo. Intente nuevamente.");
            return;
        }

        try {
            // Buscar el producto en inventario para revertir el stock
            const inventarioQuery = await db.collection('inventario').where('codigo', '==', codigoProducto).limit(1).get();
            if (!inventarioQuery.empty) {
                const productoDoc = inventarioQuery.docs[0];
                const productoData = productoDoc.data();
                
                // Verificar que al revertir no quede stock negativo
                if (productoData.stock < cantidad) {
                    alert(`No se puede eliminar esta entrada. El stock actual (${productoData.stock}) es menor que la cantidad a revertir (${cantidad}).`);
                    return;
                }
                
                // Revertir el stock en inventario
                await db.collection('inventario').doc(productoDoc.id).update({
                    stock: firebase.firestore.FieldValue.increment(-cantidad)
                });
            }
            
            // Eliminar el registro de entrada
            await db.collection('historialEntradas').doc(docId).delete();
            
            alert('Entrada eliminada exitosamente y stock revertido.');
            cargarHistorialEntradas();
            cargarInventarioCompleto();
            verificarStockBajo();
            actualizarEstadisticas();

        } catch (error) {
            console.error("Error al eliminar la entrada: ", error);
            alert("Hubo un error al eliminar el registro de entrada.");
        }
    }
}

// Función modificada para cargar historial de entradas con acciones
async function cargarHistorialEntradas() {
    const tbody = document.querySelector('#tabla-entradas-historial tbody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading">Cargando entradas...</div></td></tr>';

    if (!db) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="error-message">Error: Firestore no está inicializado</div></td></tr>';
        return;
    }

    try {
        const querySnapshot = await db.collection('historialEntradas').orderBy('fecha', 'desc').get();
        
        if(querySnapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px;">
                        <i class="fas fa-inbox" style="font-size: 48px; color: #bdc3c7; margin-bottom: 10px;"></i>
                        <div style="color: #7f8c8d;">No hay entradas registradas</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            
            // Crear botones de forma más explícita
            const editButton = document.createElement('button');
            editButton.className = 'btn-icon btn-icon-edit';
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Actualizar entrada';
            editButton.onclick = () => actualizarEntrada(doc.id);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-icon btn-icon-delete';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.title = 'Eliminar entrada';
            deleteButton.onclick = () => eliminarEntrada(doc.id, item.codigo, item.nombre, item.cantidad);
            
            const actionsCell = document.createElement('td');
            actionsCell.className = 'action-buttons-table';
            actionsCell.appendChild(editButton);
            actionsCell.appendChild(deleteButton);
            
            tr.innerHTML = `
                <td>${item.fecha}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
            `;
            tr.appendChild(actionsCell);
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar historial de entradas: ", error);
        tbody.innerHTML = '<tr><td colspan="5"><div class="error-message">Error al cargar datos</div></td></tr>';
    }
}

// --- FUNCIONES NUEVAS PARA LA TABLA DE SALIDAS ---
async function actualizarSalida(docId) {
    if (!db) {
        console.error("Firestore no está inicializado (actualizarSalida)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        const docRef = db.collection('repuestosSalida').doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            alert("El registro de salida que intentas actualizar ya no existe.");
            return;
        }
        
        const salida = docSnap.data();

        // Solicitar nuevos valores para todos los campos
        const nuevaFecha = prompt(`Actualizar fecha (actual: ${salida.fecha}):`, salida.fecha);
        if (nuevaFecha === null || nuevaFecha.trim() === '') {
            alert('Actualización cancelada. La fecha no puede estar vacía.');
            return;
        }

        const nuevoRepuesto = prompt(`Actualizar repuesto (actual: ${salida.repuesto}):`, salida.repuesto);
        if (nuevoRepuesto === null || nuevoRepuesto.trim() === '') {
            alert('Actualización cancelada. El repuesto no puede estar vacío.');
            return;
        }

        const nuevoCliente = prompt(`Actualizar cliente (actual: ${salida.cliente}):`, salida.cliente);
        if (nuevoCliente === null || nuevoCliente.trim() === '') {
            alert('Actualización cancelada. El cliente no puede estar vacío.');
            return;
        }

        const nuevoNumeroOT = prompt(`Actualizar N° OT (actual: ${salida.numeroOT}):`, salida.numeroOT);
        if (nuevoNumeroOT === null || nuevoNumeroOT.trim() === '') {
            alert('Actualización cancelada. El N° OT no puede estar vacío.');
            return;
        }

        const nuevaCantidad = prompt(`Actualizar cantidad (actual: ${salida.cantidad}):`, salida.cantidad);
        if (nuevaCantidad === null || isNaN(parseInt(nuevaCantidad)) || parseInt(nuevaCantidad) <= 0) {
            alert('Actualización cancelada. La cantidad debe ser un número válido mayor a 0.');
            return;
        }
        const cantidadInt = parseInt(nuevaCantidad);

        const nuevaPlaca = prompt(`Actualizar placa (actual: ${salida.placa || 'N/A'}):`, salida.placa || '');
        if (nuevaPlaca === null) {
            alert('Actualización cancelada.');
            return;
        }

        const nuevoKilometraje = prompt(`Actualizar kilometraje (actual: ${salida.kilometraje || 'N/A'}):`, salida.kilometraje || '');
        if (nuevoKilometraje === null) {
            alert('Actualización cancelada.');
            return;
        }
        const kilometrajeInt = nuevoKilometraje.trim() === '' ? 0 : parseInt(nuevoKilometraje);

        // Si cambió el repuesto o la cantidad, necesitamos verificar el inventario
        if (nuevoRepuesto !== salida.repuesto || cantidadInt !== salida.cantidad) {
            // Buscar el nuevo repuesto en inventario
            const nuevoRepuestoQuery = await db.collection('inventario').where('nombre', '==', nuevoRepuesto.trim().toUpperCase()).get();
            
            if (nuevoRepuestoQuery.empty) {
                alert(`El nuevo repuesto "${nuevoRepuesto}" no existe en el inventario.`);
                return;
            }
            
            const nuevoRepuestoData = nuevoRepuestoQuery.docs[0].data();
            
            // Si es el mismo repuesto pero cambió la cantidad
            if (nuevoRepuesto === salida.repuesto) {
                const diferencia = cantidadInt - salida.cantidad;
                
                if (diferencia > 0) {
                    // Si aumentó la cantidad, verificar stock suficiente
                    if (nuevoRepuestoData.stock < diferencia) {
                        alert(`Stock insuficiente para aumentar la cantidad. Stock actual: ${nuevoRepuestoData.stock}`);
                        return;
                    }
                    
                    // Restar la diferencia del inventario
                    await db.collection('inventario').doc(nuevoRepuestoQuery.docs[0].id).update({
                        stock: firebase.firestore.FieldValue.increment(-diferencia)
                    });
                } else if (diferencia < 0) {
                    // Si disminuyó la cantidad, agregar la diferencia al inventario
                    await db.collection('inventario').doc(nuevoRepuestoQuery.docs[0].id).update({
                        stock: firebase.firestore.FieldValue.increment(Math.abs(diferencia))
                    });
                }
            } else {
                // Si cambió el repuesto, revertir el stock del repuesto anterior y descontar del nuevo
                
                // 1. Revertir stock del repuesto anterior
                const repuestoAnteriorQuery = await db.collection('inventario').where('nombre', '==', salida.repuesto).get();
                if (!repuestoAnteriorQuery.empty) {
                    await db.collection('inventario').doc(repuestoAnteriorQuery.docs[0].id).update({
                        stock: firebase.firestore.FieldValue.increment(salida.cantidad)
                    });
                }
                
                // 2. Verificar stock del nuevo repuesto
                if (nuevoRepuestoData.stock < cantidadInt) {
                    alert(`Stock insuficiente del nuevo repuesto. Stock actual: ${nuevoRepuestoData.stock}`);
                    
                    // Revertir el revertido si falla
                    if (!repuestoAnteriorQuery.empty) {
                        await db.collection('inventario').doc(repuestoAnteriorQuery.docs[0].id).update({
                            stock: firebase.firestore.FieldValue.increment(-salida.cantidad)
                        });
                    }
                    return;
                }
                
                // 3. Descontar del nuevo repuesto
                await db.collection('inventario').doc(nuevoRepuestoQuery.docs[0].id).update({
                    stock: firebase.firestore.FieldValue.increment(-cantidadInt)
                });
            }
        }
        
        // Actualizar el registro de salida
        await docRef.update({
            fecha: nuevaFecha.trim(),
            repuesto: nuevoRepuesto.trim().toUpperCase(),
            cliente: nuevoCliente.trim(),
            numeroOT: nuevoNumeroOT.trim(),
            cantidad: cantidadInt,
            placa: nuevaPlaca.trim(),
            kilometraje: kilometrajeInt
        });
        
        alert(`Salida actualizada exitosamente.\n\nRepuesto: ${nuevoRepuesto}\nCliente: ${nuevoCliente}\nN° OT: ${nuevoNumeroOT}\nCantidad: ${cantidadInt}\nPlaca: ${nuevaPlaca || 'N/A'}\nKilometraje: ${kilometrajeInt || 'N/A'}`);
        cargarRepuestosSalida();
        cargarInventarioCompleto();
        verificarStockBajo();
        actualizarEstadisticas();

    } catch (error) {
        console.error("Error al actualizar la salida: ", error);
        alert("Hubo un error al actualizar el registro de salida.");
    }
}

// ====== SISTEMA DE REPORTES Y GRÁFICOS ======

// Función para inicializar la sección de reportes
function inicializarReportes() {
    // Crear instancias de gráficos vacías (incluyendo el nuevo gráfico)
    const chartConfigs = {
        'chartMovimientosDia': {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: getChartOptions('Movimientos por Día', 'Cantidad')
        },
        'chartProductosMovimientos': {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: getChartOptions('Productos con Más Movimientos', 'Cantidad')
        },
        'chartDistribucionStock': {
            type: 'pie',
            data: { labels: [], datasets: [] },
            options: getChartOptions('Distribución de Stock', '')
        },
        'chartTendenciaMensual': {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: getChartOptions('Tendencia Mensual', 'Cantidad', true)
        },
        'chartClasificacionSolicitudes': {
            type: 'pie',
            data: { labels: [], datasets: [] },
            options: getChartOptions('Clasificación de Solicitudes', '')
        }
    };

    // Inicializar todos los gráficos
    Object.keys(chartConfigs).forEach(chartId => {
        const ctx = document.getElementById(chartId).getContext('2d');
        chartInstances[chartId] = new Chart(ctx, chartConfigs[chartId]);
    });
}

// Función para obtener opciones de gráficos
function getChartOptions(title, yAxisLabel, isMultiLine = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: title
            }
        },
        scales: isMultiLine ? {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: yAxisLabel
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Período'
                }
            }
        } : undefined
    };
}

// ====== VERSIÓN ALTERNATIVA MÁS SIMPLE ======
async function exportarReporteExcel() {
    alert("Generando reporte en Excel... Esto puede tardar unos segundos.");
    
    if (!db) {
        alert("El sistema no está listo para exportar. Intente nuevamente.");
        return;
    }

    try {
        // Crear un nuevo workbook
        const wb = XLSX.utils.book_new();
        
        // Obtener datos de todas las colecciones
        const [inventarioSnapshot, entradasSnapshot, salidasSnapshot, solicitudesSnapshot] = await Promise.all([
            db.collection('inventario').get(),
            db.collection('historialEntradas').get(),
            db.collection('repuestosSalida').get(),
            db.collection('solicitudesRepuestos').get()
        ]);

        // ====== HOJA 1: RESUMEN EJECUTIVO ======
        const datosResumen = [
            ['REPORTE DE INVENTARIO - RESUMEN EJECUTIVO'],
            ['Generado:', new Date().toLocaleDateString('es-ES')],
            [''],
            ['ESTADÍSTICAS PRINCIPALES'],
            ['Total Productos en Inventario:', inventarioSnapshot.size],
            ['Productos con Stock Bajo:', inventarioSnapshot.docs.filter(doc => doc.data().stock <= 5).length],
            ['Total Entradas Registradas:', entradasSnapshot.size],
            ['Total Salidas Registradas:', salidasSnapshot.size],
            ['Solicitudes Pendientes:', solicitudesSnapshot.docs.filter(doc => doc.data().estado === 'Pendiente').length],
            [''],
            ['VALOR TOTAL DEL INVENTARIO'],
            ['Valor en Stock (S/):', inventarioSnapshot.docs.reduce((sum, doc) => {
                const item = doc.data();
                return sum + (item.stock * parseFloat(item.costoUnitario || 0));
            }, 0).toFixed(2)]
        ];

        const wsResumen = XLSX.utils.aoa_to_sheet(datosResumen);
        
        // Formato de la hoja de resumen
        wsResumen['!cols'] = [
            { width: 30 },
            { width: 20 }
        ];

        // ====== HOJA 2: INVENTARIO COMPLETO ======
        const datosInventario = [
            ['INVENTARIO COMPLETO'],
            ['Fecha', 'Código', 'Nombre', 'Lote', 'Costo Unitario (S/.)', 'Precio Venta (S/.)', 'Stock', 'Valor Total (S/.)']
        ];

        inventarioSnapshot.forEach(doc => {
            const item = doc.data();
            const valorTotal = (item.stock * parseFloat(item.costoUnitario || 0)).toFixed(2);
            datosInventario.push([
                item.fechaActualizacion || 'N/A',
                item.codigo,
                item.nombre,
                item.lote || 'N/A',
                parseFloat(item.costoUnitario).toFixed(2),
                parseFloat(item.precioVenta).toFixed(2),
                item.stock,
                valorTotal
            ]);
        });

        const wsInventario = XLSX.utils.aoa_to_sheet(datosInventario);

        // ====== HOJA 3: MOVIMIENTOS ======
        const datosMovimientos = [
            ['REGISTRO DE MOVIMIENTOS'],
            ['Tipo', 'Fecha', 'Producto/Repuesto', 'Cantidad', 'Cliente/Proveedor', 'N° OT', 'Detalles']
        ];

        // Agregar entradas
        entradasSnapshot.forEach(doc => {
            const item = doc.data();
            datosMovimientos.push([
                'ENTRADA',
                item.fecha,
                item.nombre,
                item.cantidad,
                'PROVEEDOR',
                'N/A',
                `Código: ${item.codigo}`
            ]);
        });

        // Agregar salidas
        salidasSnapshot.forEach(doc => {
            const item = doc.data();
            datosMovimientos.push([
                'SALIDA',
                item.fecha,
                item.repuesto,
                item.cantidad,
                item.cliente,
                item.numeroOT,
                `Placa: ${item.placa || 'N/A'}, KM: ${item.kilometraje || 'N/A'}`
            ]);
        });

        const wsMovimientos = XLSX.utils.aoa_to_sheet(datosMovimientos);

        // ====== HOJA 4: SOLICITUDES ======
        const datosSolicitudes = [
            ['SOLICITUDES DE REPUESTOS'],
            ['Fecha', 'Mecánico', 'Repuesto', 'Cantidad', 'Estado', 'Código']
        ];

        solicitudesSnapshot.forEach(doc => {
            const solicitud = doc.data();
            datosSolicitudes.push([
                solicitud.fecha,
                solicitud.mecanico,
                solicitud.repuesto,
                solicitud.cantidad,
                solicitud.estado,
                solicitud.codigo || 'N/A'
            ]);
        });

        const wsSolicitudes = XLSX.utils.aoa_to_sheet(datosSolicitudes);

        // ====== HOJA 5: ANÁLISIS DE STOCK ======
        const datosAnalisis = [
            ['ANÁLISIS DE STOCK'],
            ['Categoría', 'Cantidad', 'Porcentaje'],
            ['Stock Crítico (≤ 2)', 0, '0%'],
            ['Stock Bajo (3-5)', 0, '0%'],
            ['Stock Normal (6-20)', 0, '0%'],
            ['Stock Alto (>20)', 0, '0%']
        ];

        // Calcular categorías de stock
        let stockCritico = 0, stockBajo = 0, stockNormal = 0, stockAlto = 0;
        
        inventarioSnapshot.forEach(doc => {
            const stock = doc.data().stock;
            if (stock <= 2) stockCritico++;
            else if (stock <= 5) stockBajo++;
            else if (stock <= 20) stockNormal++;
            else stockAlto++;
        });

        const totalProductos = inventarioSnapshot.size;
        
        datosAnalisis[2][1] = stockCritico;
        datosAnalisis[2][2] = ((stockCritico / totalProductos) * 100).toFixed(1) + '%';
        
        datosAnalisis[3][1] = stockBajo;
        datosAnalisis[3][2] = ((stockBajo / totalProductos) * 100).toFixed(1) + '%';
        
        datosAnalisis[4][1] = stockNormal;
        datosAnalisis[4][2] = ((stockNormal / totalProductos) * 100).toFixed(1) + '%';
        
        datosAnalisis[5][1] = stockAlto;
        datosAnalisis[5][2] = ((stockAlto / totalProductos) * 100).toFixed(1) + '%';

        const wsAnalisis = XLSX.utils.aoa_to_sheet(datosAnalisis);

        // ====== AGREGAR HOJAS AL WORKBOOK ======
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Ejecutivo');
        XLSX.utils.book_append_sheet(wb, wsInventario, 'Inventario Completo');
        XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Movimientos');
        XLSX.utils.book_append_sheet(wb, wsSolicitudes, 'Solicitudes');
        XLSX.utils.book_append_sheet(wb, wsAnalisis, 'Análisis Stock');

        // ====== GENERAR ARCHIVO ======
        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Inventario_${fecha}.xlsx`);
        
        alert("✅ Reporte de Excel generado exitosamente!\n\nEl archivo contiene:\n• Resumen Ejecutivo\n• Inventario Completo\n• Movimientos\n• Solicitudes\n• Análisis de Stock");

    } catch (error) {
        console.error("Error al generar reporte Excel:", error);
        alert("❌ Error al generar el reporte de Excel. Por favor, intente nuevamente.");
    }
}

// Función para calcular fecha límite según período
// ====== FUNCIÓN CORREGIDA PARA CALCULAR FECHA LÍMITE ======
function calcularFechaLimite(periodo) {
    if (periodo === 'todo') return null;
    
    const fecha = new Date();
    
    switch(periodo) {
        case '7': // Últimos 7 días
            fecha.setDate(fecha.getDate() - 7);
            break;
        case '30': // Últimos 30 días (1 mes)
            fecha.setDate(fecha.getDate() - 30);
            break;
        case '90': // Últimos 90 días (3 meses)
            fecha.setDate(fecha.getDate() - 90);
            break;
        case '365': // Últimos 365 días (1 año)
            fecha.setDate(fecha.getDate() - 365);
            break;
        default:
            return null;
    }
    
    return fecha;
}

// ====== FUNCIONES DE IA - PREDICCIÓN INTELIGENTE DE STOCK ======
async function calcularIAStockMejorado() {
    if (!db) {
        alert('El sistema no está listo. Por favor espere y reintente.');
        return;
    }

    const diasAnalisis = parseInt(document.getElementById('ia-dias-analisis').value) || 60;
    const diasCobertura = parseInt(document.getElementById('ia-dias-cobertura').value) || 45;
    const leadtime = parseInt(document.getElementById('ia-leadtime').value) || 7;
    const seguridadPct = parseFloat(document.getElementById('ia-seguridad').value) || 25;
    const stockMinimo = parseInt(document.getElementById('ia-stock-minimo').value) || 3;

    const tbody = document.querySelector('#tabla-ia-resultados tbody');
    const metricasContainer = document.getElementById('metricas-ia');
    const alertasContainer = document.getElementById('alertas-ia');

    tbody.innerHTML = '<tr><td colspan="8">Generando predicciones, por favor espere...</td></tr>';
    metricasContainer.innerHTML = '';
    alertasContainer.innerHTML = '';

    try {
        // Fecha límite para el análisis
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasAnalisis);
        const fechaLimiteStr = fechaLimite.toISOString().slice(0,10);

        // Obtener inventario y salidas en paralelo
        const [inventarioSnap, salidasSnap] = await Promise.all([
            db.collection('inventario').get(),
            db.collection('repuestosSalida').where('fecha', '>=', fechaLimiteStr).get()
        ]);

        // Mapear demanda total por producto (por nombre)
        const demandaMap = {}; // nombre -> { total: n, porDia: m, porDias: {fecha: cantidad} }

        salidasSnap.forEach(doc => {
            const data = doc.data();
            const nombre = (data.repuesto || '').toString().trim().toUpperCase();
            const cantidad = parseInt(data.cantidad) || 0;
            const fecha = data.fecha;

            if (!demandaMap[nombre]) demandaMap[nombre] = { total: 0, porDias: {} };
            demandaMap[nombre].total += cantidad;
            demandaMap[nombre].porDias[fecha] = (demandaMap[nombre].porDias[fecha] || 0) + cantidad;
        });

        // Preparar filas
        const filas = [];
        let totalCostEstimado = 0;
        let productosCriticos = 0;

        // Para tendencia simple: comparar últimos 14 días vs anteriores 14 días
        const ventana = Math.min(14, Math.floor(diasAnalisis/2) || 7);
        const fechaVentanaReciente = new Date();
        fechaVentanaReciente.setDate(fechaVentanaReciente.getDate() - ventana + 1);
        const fechaVentanaAnterior = new Date();
        fechaVentanaAnterior.setDate(fechaVentanaAnterior.getDate() - (ventana*2) + 1);
        const fechaVentanaRecienteStr = fechaVentanaReciente.toISOString().slice(0,10);
        const fechaVentanaAnteriorStr = fechaVentanaAnterior.toISOString().slice(0,10);

        inventarioSnap.forEach(doc => {
            const item = doc.data();
            const nombre = (item.nombre || '').toString().trim().toUpperCase();
            const codigo = item.codigo || '';
            const stockActual = parseInt(item.stock) || 0;
            const costoUnitario = parseFloat(item.costoUnitario) || 0;

            const demandaInfo = demandaMap[nombre] || { total: 0, porDias: {} };
            const demandaTotal = demandaInfo.total;
            const demandaDia = demandaTotal / Math.max(diasAnalisis, 1);

            // Calcular tendencia simple (comparar sumas de ventanas)
            let sumaReciente = 0, sumaAnterior = 0;
            Object.keys(demandaInfo.porDias).forEach(f => {
                if (f >= fechaVentanaRecienteStr) sumaReciente += demandaInfo.porDias[f];
                else if (f >= fechaVentanaAnteriorStr && f < fechaVentanaRecienteStr) sumaAnterior += demandaInfo.porDias[f];
            });

            let tendencia = 'Estable';
            if (sumaAnterior === 0 && sumaReciente > 0) tendencia = 'Aumento';
            else if (sumaAnterior > 0) {
                const cambio = (sumaReciente - sumaAnterior) / sumaAnterior;
                if (cambio > 0.20) tendencia = 'Aumento';
                else if (cambio < -0.20) tendencia = 'Disminución';
            }

            const coberturaDias = demandaDia > 0 ? (stockActual / demandaDia) : Infinity;
            const seguridadFrac = seguridadPct / 100;
            const puntoPedido = Math.ceil(demandaDia * leadtime * (1 + seguridadFrac));

            // Cantidad recomendada: asegurar cobertura objetivo teniendo en cuenta leadtime y seguridad
            let cantidadRecomendada = Math.ceil((diasCobertura * demandaDia) - stockActual + (demandaDia * leadtime * seguridadFrac));
            if (isNaN(cantidadRecomendada) || cantidadRecomendada < 0) cantidadRecomendada = 0;

            const criticidad = stockActual <= stockMinimo ? 'Crítico' : (coberturaDias < leadtime ? 'Alerta' : 'Normal');
            if (criticidad === 'Crítico') productosCriticos++;

            const costoEstimado = cantidadRecomendada * costoUnitario;
            totalCostEstimado += costoEstimado;

            // Generar recomendación resumida
            let recomendacion = 'Sin acción';
            if (cantidadRecomendada > 0) {
                if (criticidad === 'Crítico') recomendacion = `Comprar urgente: ${cantidadRecomendada}`;
                else if (criticidad === 'Alerta') recomendacion = `Comprar: ${cantidadRecomendada}`;
                else recomendacion = `Considerar compra: ${cantidadRecomendada}`;
            } else {
                if (tendencia === 'Aumento') recomendacion = 'Monitorear (tendencia ↑)';
                else recomendacion = 'Mantener';
            }

            filas.push({
                codigo, nombre, stockActual, demandaDia: demandaDia.toFixed(2), cobertura: isFinite(coberturaDias) ? coberturaDias.toFixed(1) : '∞',
                puntoPedido, tendencia, criticidad, cantidadRecomendada, costoEstimado: costoEstimado.toFixed(2), recomendacion
            });
        });

        // Ordenar por criticidad y recomendación descendente
        filas.sort((a,b) => {
            const prioridad = { 'Crítico': 2, 'Alerta': 1, 'Normal': 0 };
            if (prioridad[b.criticidad] !== prioridad[a.criticidad]) return prioridad[b.criticidad] - prioridad[a.criticidad];
            return b.cantidadRecomendada - a.cantidadRecomendada;
        });

        // Renderizar tabla
        if (filas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No hay datos suficientes para generar predicciones.</td></tr>';
        } else {
            tbody.innerHTML = '';
            filas.forEach(f => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${f.nombre}</td>
                    <td>${f.stockActual}</td>
                    <td>${f.demandaDia}</td>
                    <td>${f.cobertura}</td>
                    <td>${f.puntoPedido}</td>
                    <td>${f.tendencia}</td>
                    <td>${f.criticidad}</td>
                    <td>${f.recomendacion}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Métricas bonito
        const fechaGeneracion = new Date().toLocaleString();
        metricasContainer.innerHTML = `
            <div class="ia-metrics">
                <div class="ia-metric-card">
                    <div class="ia-metric-icon"><i class="fas fa-boxes"></i></div>
                    <div class="ia-metric-body">
                        <div class="ia-metric-title">Productos Analizados</div>
                        <div class="ia-metric-value">${filas.length}</div>
                    </div>
                </div>
                <div class="ia-metric-card ia-metric-warning">
                    <div class="ia-metric-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="ia-metric-body">
                        <div class="ia-metric-title">Productos Críticos</div>
                        <div class="ia-metric-value">${productosCriticos}</div>
                    </div>
                </div>
                <div class="ia-metric-card">
                    <div class="ia-metric-icon"><i class="fas fa-dollar-sign"></i></div>
                    <div class="ia-metric-body">
                        <div class="ia-metric-title">Costo Estimado Reposiciones</div>
                        <div class="ia-metric-value">S/ ${totalCostEstimado.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            <div class="ia-metrics-footer">Generado: ${fechaGeneracion}</div>
        `;

        // Alertas principales (primeras 5 críticas) con estilo
        const alertas = filas.filter(f => f.criticidad === 'Crítico');
        if (alertas.length > 0) {
            alertasContainer.innerHTML = `
                <div class="ia-alerts">
                    <div class="ia-alerts-header"><i class="fas fa-bullhorn"></i> Alertas críticas</div>
                    <ul class="ia-alert-list">
                        ${alertas.map(a => `
                            <li class="ia-alert-item">
                                <div class="ia-alert-left">
                                    <div class="ia-alert-product">${a.nombre}</div>
                                    <div class="ia-alert-sub">Stock: <strong>${a.stockActual}</strong></div>
                                </div>
                                <div class="ia-alert-right">
                                    <span class="ia-badge">Recomendado: ${a.cantidadRecomendada}</span>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            alertasContainer.innerHTML = `
                <div class="ia-alerts ia-alerts-empty">
                    <div class="ia-alerts-header"><i class="fas fa-check-circle"></i> Sin alertas críticas</div>
                    <div class="ia-alerts-sub">No se detectaron productos en estado crítico durante el análisis.</div>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error en calcularIAStockMejorado:', error);
        tbody.innerHTML = '<tr><td colspan="10">Error al generar predicciones. Revisa la consola.</td></tr>';
        metricasContainer.innerHTML = '';
        alertasContainer.innerHTML = '';
    }
}

function inicializarIA() {
    // Restaurar valores por defecto y limpiar vistas
    document.getElementById('ia-dias-analisis').value = 60;
    document.getElementById('ia-dias-cobertura').value = 45;
    document.getElementById('ia-leadtime').value = 7;
    document.getElementById('ia-seguridad').value = 25;
    document.getElementById('ia-stock-minimo').value = 3;

    document.querySelector('#tabla-ia-resultados tbody').innerHTML = '';
    document.getElementById('metricas-ia').innerHTML = '';
    document.getElementById('alertas-ia').innerHTML = '';
}

async function generarSolicitudIA(codigo, nombre, cantidad) {
    if (!db) { alert('Base de datos no disponible.'); return; }
    if (!codigo || !nombre || cantidad <= 0) { alert('Datos inválidos para generar solicitud.'); return; }

    if (!confirm(`Generar solicitud de ${cantidad} unidades de ${nombre}?`)) return;

    try {
        await db.collection('solicitudesRepuestos').add({
            fecha: new Date().toISOString().slice(0,10),
            mecanico: 'Sistema-IA',
            codigo: codigo,
            repuesto: nombre,
            cantidad: cantidad,
            estado: 'Pendiente'
        });
        alert('Solicitud generada correctamente.');
        verificarSolicitudesPendientes();
    } catch (err) {
        console.error('Error al generar solicitud IA:', err);
        alert('No se pudo generar la solicitud. Ve la consola para detalles.');
    }
}

async function exportarIAPDF() {
    try {
        const contenedor = document.getElementById('apartado-ia');
        if (!contenedor) { 
            alert('No se encontró la sección IA.'); 
            return; 
        }

        // Verificar que haya datos generados
        const tbody = document.querySelector('#tabla-ia-resultados tbody');
        if (!tbody || tbody.children.length === 0) {
            alert('Por favor ejecuta primero el Análisis IA antes de exportar.');
            return;
        }

        // Guardar estado original
        const displayOriginal = contenedor.style.display;
        const positionOriginal = contenedor.style.position;
        const zIndexOriginal = contenedor.style.zIndex;
        const topOriginal = contenedor.style.top;
        
        // Hacer visible y traer al frente sin modificar layout
        contenedor.style.display = 'block';
        contenedor.style.position = 'relative';
        contenedor.style.zIndex = '9999';
        contenedor.style.top = '0';
        
        // Pequeña pausa para renderizado
        await new Promise(r => setTimeout(r, 800));

        // Agregar estilos temporales para que la tabla quepa mejor en el PDF
        const tabla = document.querySelector('#tabla-ia-resultados');
        const estiloOriginal = tabla.style.cssText;
        tabla.style.width = '100%';
        tabla.style.tableLayout = 'auto';
        tabla.style.fontSize = '12px';
        
        // Ajustar específicamente la columna de Recomendación
        const celdasRecomendacion = tabla.querySelectorAll('td:last-child, th:last-child');
        celdasRecomendacion.forEach(celda => {
            celda.style.width = '25%';
            celda.style.whiteSpace = 'normal';
            celda.style.wordWrap = 'break-word';
        });

        const fecha = new Date().toISOString().slice(0,10);
        const opt = {
            margin: 8,
            filename: `IA_Prediccion_Stock_${fecha}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { 
                scale: 1.8, 
                useCORS: true, 
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'landscape',
                compress: true
            },
            pagebreak: { 
                mode: ['css', 'legacy'],
                avoid: ['tr', 'th', 'td']
            }
        };

        console.log('Iniciando exportación PDF...');
        console.log('Filas detectadas:', document.querySelectorAll('#tabla-ia-resultados tbody tr').length);
        
        // Exportar
        await html2pdf()
            .set(opt)
            .from(contenedor)
            .toPdf()
            .get('pdf')
            .then(pdf => {
                const total = pdf.internal.getNumberOfPages();
                if (total > 2) {
                    for (let i = total; i > 2; i--) {
                        pdf.deletePage(i);
                    }
                }
            })
            .save();
        
        // Restaurar estado original
        contenedor.style.display = displayOriginal;
        contenedor.style.position = positionOriginal;
        contenedor.style.zIndex = zIndexOriginal;
        contenedor.style.top = topOriginal;
        tabla.style.cssText = estiloOriginal;
        
        console.log('PDF exportado exitosamente');

    } catch (error) {
        console.error('Error exportando IA a PDF:', error);
        alert('Error al exportar PDF: ' + error.message);
    }
}

// Función auxiliar para escapar HTML (evitar inyección al construir el PDF)
function escapeHtml(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\'/g, '&#039;');
}


// ====== EXPORTAR REPORTES A PDF (incluye todos los gráficos) ======
async function exportarReportePDF() {
    try {
        const contenedor = document.getElementById('apartado-reportes');
        if (!contenedor) {
            alert('No se encontró la sección de reportes.');
            return;
        }

        // Asegurar que la sección esté visible y actualizada
        const estabaOculto = contenedor.style.display === 'none' || getComputedStyle(contenedor).display === 'none';
        if (estabaOculto) {
            mostrarApartado('reportes');
        } else {
            await generarReportes();
        }

        // Pequeño retraso para que los gráficos terminen de renderizar
        await new Promise(r => setTimeout(r, 500));

        // Ocultar temporalmente los filtros y aplicar escala para que todo quepa en 1 hoja
        const filtros = contenedor.querySelector('.sub-section-container');
        const filtrosDisplayOriginal = filtros ? filtros.style.display : '';
        if (filtros) filtros.style.display = 'none';

        const transformOriginal = contenedor.style.transform;
        const transformOriginOriginal = contenedor.style.transformOrigin;
        const widthOriginal = contenedor.style.width;
        contenedor.style.transform = 'scale(0.86)';
        contenedor.style.transformOrigin = 'top left';
        contenedor.style.width = '100%';

        // Centrar gráficos y forzar 2 por hoja (2 primeros en hoja 1, 2 siguientes en hoja 2)
        const chartsGrid = contenedor.querySelector('.charts-grid');
        const chartContainers = chartsGrid ? chartsGrid.querySelectorAll('.chart-container') : [];
        const chartsGridDisplayOriginal = chartsGrid ? chartsGrid.style.display : '';
        const chartsGridGapOriginal = chartsGrid ? chartsGrid.style.gap : '';
        if (chartsGrid) {
            chartsGrid.style.display = 'block';
            chartsGrid.style.gap = '0px';
        }
        const chartOriginals = [];
        chartContainers.forEach(c => {
            chartOriginals.push({ el: c, style: c.style.cssText });
            c.style.width = '80%';
            c.style.margin = '10px auto';
            c.style.pageBreakInside = 'avoid';
            c.style.breakInside = 'avoid';
            c.style.webkitColumnBreakInside = 'avoid';
            c.style.overflow = 'hidden';
        });

        // Insertar salto de página después del segundo gráfico
        let pageBreakEl = null;
        if (chartContainers.length > 2) {
            pageBreakEl = document.createElement('div');
            pageBreakEl.className = 'html2pdf__page-break';
            chartContainers[1].after(pageBreakEl);
        }

        const fecha = new Date().toISOString().slice(0, 10);
        const opt = {
            margin:       4, // mm
            filename:     `Reporte_Inventario_${fecha}.pdf`,
            image:        { type: 'jpeg', quality: 0.95 },
            html2canvas:  { scale: 1.6, useCORS: true, logging: false, backgroundColor: '#ffffff' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy', 'avoid-all'], avoid: ['.chart-container', '.chart-wrapper', 'canvas'] }
        };

        await html2pdf()
            .set(opt)
            .from(contenedor)
            .toPdf()
            .get('pdf')
            .then(pdf => {
                const total = pdf.internal.getNumberOfPages();
                if (total > 2) {
                    for (let i = total; i > 2; i--) {
                        pdf.deletePage(i);
                    }
                }
            })
            .save();

        // Restaurar estilos temporales
        if (filtros) filtros.style.display = filtrosDisplayOriginal;
        contenedor.style.transform = transformOriginal;
        contenedor.style.transformOrigin = transformOriginOriginal;
        contenedor.style.width = widthOriginal;
        if (chartsGrid) {
            chartsGrid.style.display = chartsGridDisplayOriginal;
            chartsGrid.style.gap = chartsGridGapOriginal;
        }
        chartOriginals.forEach(({ el, style }) => { el.style.cssText = style; });
        if (pageBreakEl && pageBreakEl.parentNode) pageBreakEl.parentNode.removeChild(pageBreakEl);

        // Volver a la vista principal si estaba oculta
        if (estabaOculto) {
            mostrarApartado('');
        }

    } catch (error) {
        console.error('Error al exportar PDF:', error);
        alert('Ocurrió un error al exportar el PDF.');
    }
}

// ====== EXPORTAR EXCEL (4 hojas: Inventario, Entradas, Salidas, Solicitudes) ======
async function exportarExcel() {
    if (!db) {
        alert("El sistema no está listo para exportar. Intente nuevamente.");
        return;
    }

    try {
        const wb = XLSX.utils.book_new();
        const [inventarioSnapshot, entradasSnapshot, salidasSnapshot, solicitudesSnapshot] = await Promise.all([
            db.collection('inventario').get(),
            db.collection('historialEntradas').get(),
            db.collection('repuestosSalida').get(),
            db.collection('solicitudesRepuestos').get()
        ]);

        // Hoja: Inventario (stock actual)
        const datosInventario = [
            ['Fecha', 'Código', 'Nombre', 'Lote', 'Costo Unitario (S/.)', 'Precio Venta (S/.)', 'Stock']
        ];
        inventarioSnapshot.forEach(doc => {
            const it = doc.data();
            datosInventario.push([
                it.fechaActualizacion || 'N/A',
                it.codigo,
                it.nombre,
                it.lote || 'N/A',
                parseFloat(it.costoUnitario || 0).toFixed(2),
                parseFloat(it.precioVenta || 0).toFixed(2),
                it.stock
            ]);
        });
        const wsInventario = XLSX.utils.aoa_to_sheet(datosInventario);
        wsInventario['!cols'] = [
            { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 8 }
        ];
        if (wsInventario['!ref']) wsInventario['!autofilter'] = { ref: wsInventario['!ref'] };
        XLSX.utils.book_append_sheet(wb, wsInventario, 'Inventario');

        // Hoja: Entradas (historial)
        const datosEntradas = [
            ['Fecha', 'Código', 'Nombre', 'Cantidad']
        ];
        entradasSnapshot.forEach(doc => {
            const it = doc.data();
            datosEntradas.push([it.fecha, it.codigo, it.nombre, it.cantidad]);
        });
        const wsEntradas = XLSX.utils.aoa_to_sheet(datosEntradas);
        wsEntradas['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 10 }];
        if (wsEntradas['!ref']) wsEntradas['!autofilter'] = { ref: wsEntradas['!ref'] };
        XLSX.utils.book_append_sheet(wb, wsEntradas, 'Entradas');

        // Hoja: Salidas (historial)
        const datosSalidas = [
            ['Fecha', 'Repuesto', 'Cantidad', 'Cliente', 'N° OT', 'Placa', 'KM']
        ];
        salidasSnapshot.forEach(doc => {
            const it = doc.data();
            datosSalidas.push([it.fecha, it.repuesto, it.cantidad, it.cliente, it.numeroOT, it.placa || 'N/A', it.kilometraje || 'N/A']);
        });
        const wsSalidas = XLSX.utils.aoa_to_sheet(datosSalidas);
        wsSalidas['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
        if (wsSalidas['!ref']) wsSalidas['!autofilter'] = { ref: wsSalidas['!ref'] };
        XLSX.utils.book_append_sheet(wb, wsSalidas, 'Salidas');

        // Hoja: Solicitudes (historial)
        const datosSolicitudes = [
            ['Fecha', 'Mecánico', 'Repuesto', 'Cantidad', 'Estado', 'Código']
        ];
        solicitudesSnapshot.forEach(doc => {
            const it = doc.data();
            datosSolicitudes.push([it.fecha, it.mecanico, it.repuesto, it.cantidad, it.estado, it.codigo || 'N/A']);
        });
        const wsSolicitudes = XLSX.utils.aoa_to_sheet(datosSolicitudes);
        wsSolicitudes['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
        if (wsSolicitudes['!ref']) wsSolicitudes['!autofilter'] = { ref: wsSolicitudes['!ref'] };
        XLSX.utils.book_append_sheet(wb, wsSolicitudes, 'Solicitudes');

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Inventario_${fecha}.xlsx`);
        alert('✅ EXCEL GENERADO EXITOSAMENTE!\n\nCONTENIDO:\n• INVENTARIO (Stock actual)\n• ENTRADAS (Historial)\n• SALIDAS (Historial)\n• SOLICITUDES (Historial)\n\n⚙ Los encabezados tienen auto-filtro.');
    } catch (error) {
        console.error('Error al generar Excel:', error);
        alert('❌ Error al generar el Excel.');
    }
}

// ====== FUNCIÓN CORREGIDA PARA GENERAR REPORTES ======
async function generarReportes() {
    if (!db) {
        console.error("Firestore no está inicializado");
        return;
    }

    const periodo = document.getElementById('filtro-periodo').value;
    const tipoReporte = document.getElementById('filtro-tipo-reporte').value;
    
    try {
        // Obtener datos necesarios
        const [inventarioData, entradasData, salidasData, solicitudesData] = await Promise.all([
            db.collection('inventario').get(),
            db.collection('historialEntradas').get(),
            db.collection('repuestosSalida').get(),
            db.collection('solicitudesRepuestos').get()
        ]);

        // Filtrar datos por período
        const fechaLimite = calcularFechaLimite(periodo);
        
        const entradasFiltradas = entradasData.docs.filter(doc => {
            if (!fechaLimite) return true;
            const fechaDoc = new Date(doc.data().fecha + 'T00:00:00');
            return fechaDoc >= fechaLimite;
        });
        
        const salidasFiltradas = salidasData.docs.filter(doc => {
            if (!fechaLimite) return true;
            const fechaDoc = new Date(doc.data().fecha + 'T00:00:00');
            return fechaDoc >= fechaLimite;
        });

        console.log(`Período: ${periodo}, Entradas: ${entradasFiltradas.length}, Salidas: ${salidasFiltradas.length}`);

        // Generar los 4 gráficos restantes
        generarGraficoMovimientosDia(entradasFiltradas, salidasFiltradas);
        generarGraficoProductosMovimientos(entradasFiltradas, salidasFiltradas);
        generarGraficoDistribucionStock(inventarioData);
        generarGraficoTendenciaMensual(entradasFiltradas, salidasFiltradas);
        
        // Actualizar estadísticas resumen
        actualizarEstadisticasResumen(
            entradasFiltradas, 
            salidasFiltradas, 
            solicitudesData.docs, 
            inventarioData
        );

    } catch (error) {
        console.error("Error al generar reportes:", error);
        alert("Error al generar los reportes estadísticos.");
    }
}

// ====== INICIALIZAR GRÁFICOS AL ENTRAR A REPORTES ======
function inicializarReportes() {
    // Solo inicializar si no existen
    if (Object.keys(chartInstances).length === 0) {
        const chartsConfig = {
            'chartMovimientosDia': { type: 'line' },
            'chartProductosMovimientos': { type: 'bar' },
            'chartDistribucionStock': { type: 'pie' },
            'chartTendenciaMensual': { type: 'line' }
        };

        Object.keys(chartsConfig).forEach(chartId => {
            const canvas = document.getElementById(chartId);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                chartInstances[chartId] = new Chart(ctx, {
                    type: chartsConfig[chartId].type,
                    data: { labels: [], datasets: [] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top',
                                labels: {
                                    font: { 
                                        size: 11 
                                    }
                               }
                            }
                        }
                    }
                });
            }
        });
    }
    
    // Generar reportes automáticamente
    generarReportes();
}

// Gráfico 1: Movimientos por día
function generarGraficoMovimientosDia(entradas, salidas) {
    const movimientosPorDia = {};
    
    // Procesar entradas
    entradas.forEach(doc => {
        const data = doc.data();
        const fecha = data.fecha;
        if (!movimientosPorDia[fecha]) {
            movimientosPorDia[fecha] = { entradas: 0, salidas: 0 };
        }
        movimientosPorDia[fecha].entradas += data.cantidad;
    });
    
    // Procesar salidas
    salidas.forEach(doc => {
        const data = doc.data();
        const fecha = data.fecha;
        if (!movimientosPorDia[fecha]) {
            movimientosPorDia[fecha] = { entradas: 0, salidas: 0 };
        }
        movimientosPorDia[fecha].salidas += data.cantidad;
    });
    
    // Ordenar fechas
    const fechas = Object.keys(movimientosPorDia).sort();
    const ultimasFechas = fechas.slice(-15); // Últimos 15 días
    
    const datosEntradas = ultimasFechas.map(fecha => movimientosPorDia[fecha].entradas);
    const datosSalidas = ultimasFechas.map(fecha => movimientosPorDia[fecha].salidas);
    
    // Actualizar gráfico
    chartInstances.chartMovimientosDia.data.labels = ultimasFechas;
    chartInstances.chartMovimientosDia.data.datasets = [
        {
            label: 'Entradas',
            data: datosEntradas,
            borderColor: '#4361ee',
            backgroundColor: 'rgba(67, 97, 238, 0.1)',
            tension: 0.4,
            fill: true
        },
        {
            label: 'Salidas',
            data: datosSalidas,
            borderColor: '#f72585',
            backgroundColor: 'rgba(247, 37, 133, 0.1)',
            tension: 0.4,
            fill: true
        }
    ];
    chartInstances.chartMovimientosDia.update();
}

// Gráfico 2: Productos con más movimientos
function generarGraficoProductosMovimientos(entradas, salidas) {
    const movimientosProductos = {};
    
    // Contar movimientos por producto
    [...entradas, ...salidas].forEach(doc => {
        const data = doc.data();
        const producto = data.nombre || data.repuesto;
        if (producto) {
            if (!movimientosProductos[producto]) {
                movimientosProductos[producto] = 0;
            }
            movimientosProductos[producto] += data.cantidad;
        }
    });
    
    // Ordenar y tomar top 10
    const productosTop = Object.entries(movimientosProductos)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const nombres = productosTop.map(([nombre]) => nombre);
    const cantidades = productosTop.map(([, cantidad]) => cantidad);
    
    chartInstances.chartProductosMovimientos.data.labels = nombres;
    chartInstances.chartProductosMovimientos.data.datasets = [{
        label: 'Cantidad Movida',
        data: cantidades,
        backgroundColor: [
            '#4361ee', '#7209b7', '#f72585', '#4cc9f0', 
            '#4895ef', '#3a0ca3', '#f8961e', '#2a9d8f', 
            '#e9c46a', '#e76f51'
        ],
        borderWidth: 1
    }];
    chartInstances.chartProductosMovimientos.update();
}

// Gráfico 3: Distribución de stock
function generarGraficoDistribucionStock(inventario) {
    const categoriasStock = {
        'Stock Bajo (≤5)': 0,
        'Stock Medio (6-20)': 0,
        'Stock Alto (>20)': 0
    };
    
    inventario.forEach(doc => {
        const stock = doc.data().stock;
        if (stock <= 5) {
            categoriasStock['Stock Bajo (≤5)']++;
        } else if (stock <= 20) {
            categoriasStock['Stock Medio (6-20)']++;
        } else {
            categoriasStock['Stock Alto (>20)']++;
        }
    });
    
    const labels = Object.keys(categoriasStock);
    const data = Object.values(categoriasStock);
    
    chartInstances.chartDistribucionStock.data.labels = labels;
    chartInstances.chartDistribucionStock.data.datasets = [{
        data: data,
        backgroundColor: ['#f72585', '#f8961e', '#4cc9f0'],
        borderWidth: 2,
        borderColor: '#fff'
    }];
    chartInstances.chartDistribucionStock.update();
}

// Gráfico 4: Tendencia mensual
function generarGraficoTendenciaMensual(entradas, salidas) {
    const movimientosMensuales = {};
    
    // Procesar entradas mensuales
    entradas.forEach(doc => {
        const data = doc.data();
        const fecha = new Date(data.fecha);
        const mesKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
        const mesLabel = `${fecha.toLocaleString('es-ES', { month: 'short' })} ${fecha.getFullYear()}`;
        
        if (!movimientosMensuales[mesKey]) {
            movimientosMensuales[mesKey] = {
                label: mesLabel,
                entradas: 0,
                salidas: 0
            };
        }
        movimientosMensuales[mesKey].entradas += data.cantidad;
    });
    
    // Procesar salidas mensuales
    salidas.forEach(doc => {
        const data = doc.data();
        const fecha = new Date(data.fecha);
        const mesKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
        const mesLabel = `${fecha.toLocaleString('es-ES', { month: 'short' })} ${fecha.getFullYear()}`;
        
        if (!movimientosMensuales[mesKey]) {
            movimientosMensuales[mesKey] = {
                label: mesLabel,
                entradas: 0,
                salidas: 0
            };
        }
        movimientosMensuales[mesKey].salidas += data.cantidad;
    });
    
    // Ordenar por fecha
    const mesesOrdenados = Object.values(movimientosMensuales)
        .sort((a, b) => new Date(a.label) - new Date(b.label));
    
    const labels = mesesOrdenados.map(mes => mes.label);
    const datosEntradas = mesesOrdenados.map(mes => mes.entradas);
    const datosSalidas = mesesOrdenados.map(mes => mes.salidas);
    
    chartInstances.chartTendenciaMensual.data.labels = labels;
    chartInstances.chartTendenciaMensual.data.datasets = [
        {
            label: 'Entradas Mensuales',
            data: datosEntradas,
            borderColor: '#4361ee',
            backgroundColor: 'rgba(67, 97, 238, 0.1)',
            fill: true,
            tension: 0.4
        },
        {
            label: 'Salidas Mensuales',
            data: datosSalidas,
            borderColor: '#f72585',
            backgroundColor: 'rgba(247, 37, 133, 0.1)',
            fill: true,
            tension: 0.4
        }
    ];
    chartInstances.chartTendenciaMensual.update();
}

// NUEVO GRÁFICO 5: Clasificación de solicitudes
function generarGraficoClasificacionSolicitudes(solicitudes) {
    const clasificacion = {
        'Pendientes': 0,
        'Aceptadas': 0,
        'Rechazadas': 0,
        'Rechazadas - No Existe': 0,
        'Rechazadas - Stock Insuficiente': 0
    };
    
    // Contar solicitudes por estado
    solicitudes.forEach(doc => {
        const estado = doc.data().estado;
        if (clasificacion.hasOwnProperty(estado)) {
            clasificacion[estado]++;
        } else {
            clasificacion['Pendientes']++; // Por si hay algún estado no contemplado
        }
    });
    
    // Filtrar solo los estados que tienen valores
    const estadosConValores = Object.entries(clasificacion).filter(([, valor]) => valor > 0);
    
    const labels = estadosConValores.map(([estado]) => estado);
    const data = estadosConValores.map(([, valor]) => valor);
    
    // Colores para cada estado
    const colores = {
        'Pendientes': '#f8961e', // Naranja
        'Aceptadas': '#4cc9f0',  // Azul claro
        'Rechazadas': '#f72585', // Rosa
        'Rechazadas - No Existe': '#e76f51', // Rojo anaranjado
        'Rechazadas - Stock Insuficiente': '#7209b7' // Morado
    };
    
    const backgroundColor = labels.map(label => colores[label] || '#6c757d');
    
    chartInstances.chartClasificacionSolicitudes.data.labels = labels;
    chartInstances.chartClasificacionSolicitudes.data.datasets = [{
        data: data,
        backgroundColor: backgroundColor,
        borderWidth: 2,
        borderColor: '#fff'
    }];
    chartInstances.chartClasificacionSolicitudes.update();
}

// Actualizar estadísticas resumen
function actualizarEstadisticasResumen(entradas, salidas, solicitudes, inventario) {
    // Total entradas
    const totalEntradas = entradas.reduce((sum, doc) => sum + doc.data().cantidad, 0);
    document.getElementById('total-entradas').textContent = totalEntradas.toLocaleString();
    
    // Total salidas
    const totalSalidas = salidas.reduce((sum, doc) => sum + doc.data().cantidad, 0);
    document.getElementById('total-salidas').textContent = totalSalidas.toLocaleString();
    
    // Total solicitudes
    document.getElementById('total-solicitudes').textContent = solicitudes.length.toLocaleString();
    
    // Productos activos (con stock > 0)
    const productosActivos = inventario.docs.filter(doc => doc.data().stock > 0).length;
    document.getElementById('productos-activos').textContent = productosActivos.toLocaleString();
    
    // Valor total del inventario
    const valorTotal = inventario.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.stock * parseFloat(data.costoUnitario || 0));
    }, 0);
    document.getElementById('valor-total').textContent = `S/ ${valorTotal.toFixed(2)}`;
}

// Función auxiliar para texto del filtro
function obtenerTextoFiltro(filtro) {
    switch(filtro) {
        case 'pendientes': return 'pendientes';
        case 'aceptadas': return 'aceptadas';
        case 'rechazadas': return 'rechazadas';
        default: return '';
    }
}

// Función para filtrar solicitudes
function filtrarSolicitudes() {
    cargarSolicitudesAdmin();
}

// ====== FUNCIONES PARA ELIMINACIÓN MÚLTIPLE DE SOLICITUDES ======

// Variables globales para gestión de selección múltiple
let modoEliminacionMultiple = false;
let solicitudesSeleccionadas = new Set();

// Función para mostrar/ocultar opciones de eliminación múltiple
function mostrarOpcionesEliminar() {
    modoEliminacionMultiple = true;
    document.getElementById('columna-seleccion').style.display = 'table-cell';
    document.getElementById('btn-eliminar-multiples').style.display = 'none';
    document.getElementById('btn-cancelar-eliminar').style.display = 'inline-block';
    
    // Mostrar checkboxes en todas las filas
    const filas = document.querySelectorAll('#tabla-solicitudes tbody tr');
    filas.forEach(fila => {
        if (!fila.querySelector('.checkbox-seleccion')) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'checkbox-seleccion';
            checkbox.onchange = function() {
                toggleSeleccionSolicitud(this);
            };
            
            const celda = document.createElement('td');
            celda.style.display = 'table-cell';
            celda.appendChild(checkbox);
            fila.insertBefore(celda, fila.firstChild);
        }
    });
}

function ocultarOpcionesEliminar() {
    modoEliminacionMultiple = false;
    solicitudesSeleccionadas.clear();
    document.getElementById('columna-seleccion').style.display = 'none';
    document.getElementById('btn-eliminar-multiples').style.display = 'inline-block';
    document.getElementById('btn-cancelar-eliminar').style.display = 'none';
    document.getElementById('select-all').checked = false;
    
    // Ocultar y remover checkboxes
    const checkboxes = document.querySelectorAll('.checkbox-seleccion');
    checkboxes.forEach(checkbox => {
        checkbox.parentElement.remove();
    });
}

// Función para seleccionar/deseleccionar todas las solicitudes
function seleccionarTodos(checkbox) {
    const checkboxes = document.querySelectorAll('.checkbox-seleccion');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        toggleSeleccionSolicitud(cb);
    });
}

// Función para manejar la selección individual
function toggleSeleccionSolicitud(checkbox) {
    const fila = checkbox.closest('tr');
    const docId = fila.getAttribute('data-doc-id');
    
    if (checkbox.checked) {
        solicitudesSeleccionadas.add(docId);
        fila.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    } else {
        solicitudesSeleccionadas.delete(docId);
        fila.style.backgroundColor = '';
        document.getElementById('select-all').checked = false;
    }
    
    // Actualizar contador en el botón
    const btnEliminar = document.getElementById('btn-eliminar-multiples');
    if (btnEliminar) {
        if (solicitudesSeleccionadas.size > 0) {
            btnEliminar.innerHTML = `<i class="fas fa-trash"></i> Eliminar (${solicitudesSeleccionadas.size})`;
        } else {
            btnEliminar.innerHTML = `<i class="fas fa-trash"></i> Eliminar Seleccionadas`;
        }
    }
}

// Función para eliminar múltiples solicitudes
async function eliminarSolicitudesMultiples() {
    if (solicitudesSeleccionadas.size === 0) {
        alert('Por favor, selecciona al menos una solicitud para eliminar.');
        return;
    }
    
    const confirmacion = confirm(`¿Estás seguro de que quieres eliminar ${solicitudesSeleccionadas.size} solicitud(es)? Esta acción no se puede deshacer.`);
    
    if (!confirmacion) return;
    
    if (!db) {
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }
    
    try {
        const eliminaciones = Array.from(solicitudesSeleccionadas).map(docId => 
            db.collection('solicitudesRepuestos').doc(docId).delete()
        );
        
        await Promise.all(eliminaciones);
        
        alert(`${solicitudesSeleccionadas.size} solicitud(es) eliminada(s) exitosamente.`);
        solicitudesSeleccionadas.clear();
        ocultarOpcionesEliminar();
        cargarSolicitudesAdmin();
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("Error al eliminar múltiples solicitudes:", error);
        alert("Hubo un error al eliminar las solicitudes.");
    }
}

// Función para eliminar una solicitud individual
async function eliminarSolicitudIndividual(docId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta solicitud? Esta acción no se puede deshacer.')) {
        if (!db) {
            alert("El sistema no está listo. Intente nuevamente.");
            return;
        }
        
        try {
            await db.collection('solicitudesRepuestos').doc(docId).delete();
            alert('Solicitud eliminada exitosamente.');
            cargarSolicitudesAdmin();
            verificarSolicitudesPendientes();
            actualizarEstadisticas();
            
        } catch (error) {
            console.error("Error al eliminar solicitud individual:", error);
            alert("Hubo un error al eliminar la solicitud.");
        }
    }
}

// Función auxiliar corregida para texto del filtro
function obtenerTextoFiltro(filtro) {
    switch(filtro) {
        case 'pendientes': return 'pendientes';
        case 'aceptadas': return 'aceptadas';
        case 'rechazadas': return 'rechazadas';
        case 'todas': return '';
        default: return '';
    }
}

// Función para filtrar solicitudes por botones
function filtrarSolicitudesPorTipo(tipo) {
    // Remover clase active de todos los botones
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Agregar clase active al botón clickeado
    document.getElementById(`btn-${tipo}`).classList.add('active');
    
    // Cargar las solicitudes con el filtro seleccionado
    cargarSolicitudesAdmin(tipo);
}

// Función modificada para cargar solicitudes que acepta el tipo como parámetro
async function cargarSolicitudesAdmin(tipoFiltro = null) {
    const tbody = document.querySelector('#tabla-solicitudes tbody');
    
    // Si no se pasa tipoFiltro, usar el del botón activo
    if (!tipoFiltro) {
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        tipoFiltro = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
    }
    
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    
    if (!db) {
        tbody.innerHTML = '<tr><td colspan="6">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarSolicitudesAdmin)");
        return;
    }

    try {
        let query = db.collection('solicitudesRepuestos').orderBy('fecha', 'desc');
        
        // Aplicar filtro según el tipo seleccionado
        if (tipoFiltro === 'pendientes') {
            query = query.where('estado', '==', 'Pendiente');
        } else if (tipoFiltro === 'aceptadas') {
            query = query.where('estado', '==', 'Aceptada');
        } else if (tipoFiltro === 'rechazadas') {
            // Para filtrar múltiples estados de rechazo
            query = query.where('estado', 'in', ['Rechazada', 'Rechazada - No Existe', 'Rechazada - Stock Insuficiente']);
        }
        // Para "todas" no aplicamos ningún filtro where
        
        const querySnapshot = await query.get();
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6">No hay solicitudes ${obtenerTextoFiltro(tipoFiltro)}.</td></tr>`;
            return;
        }

        querySnapshot.forEach(doc => {
            const solicitud = doc.data();
            const docId = doc.id;
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>${solicitud.fecha}</td>
                <td>${solicitud.mecanico}</td>
                <td>${solicitud.repuesto}</td>
                <td>${solicitud.cantidad}</td>
                <td><span class="estado-${solicitud.estado.toLowerCase().replace(/ /g, '-')}">${solicitud.estado}</span></td>
                <td class="action-buttons-table">
                    ${solicitud.estado === 'Pendiente' ? 
                    `<button class="btn-icon btn-icon-accept" onclick="aceptarSolicitud('${docId}', '${solicitud.repuesto}', ${solicitud.cantidad})" title="Aceptar solicitud">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-icon btn-icon-reject" onclick="rechazarSolicitud('${docId}')" title="Rechazar solicitud">
                        <i class="fas fa-times"></i>
                    </button>` : 
                    `<button class="btn-icon btn-icon-delete" onclick="eliminarSolicitudIndividual('${docId}')" title="Eliminar solicitud">
                        <i class="fas fa-trash"></i>
                    </button>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error("Error al cargar solicitudes:", error);
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar datos.</td></tr>';
    }
}

// Función auxiliar para texto del filtro
function obtenerTextoFiltro(filtro) {
    switch(filtro) {
        case 'pendientes': return 'pendientes';
        case 'aceptadas': return 'aceptadas';
        case 'rechazadas': return 'rechazadas';
        case 'todas': return '';
        default: return '';
    }
}

// ====== FUNCIONES PARA FILTRAR SOLICITUDES ======

// Función para filtrar solicitudes por botones
function filtrarSolicitudesPorTipo(tipo) {
    console.log(`Filtrando por: ${tipo}`);
    
    // Remover clase active de todos los botones
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Agregar clase active al botón clickeado
    const botonClickeado = document.getElementById(`btn-${tipo}`);
    if (botonClickeado) {
        botonClickeado.classList.add('active');
    }
    
    // Cargar las solicitudes con el filtro seleccionado
    cargarSolicitudesAdmin(tipo);
}

// ====== FUNCIONES UNIFICADAS Y CORREGIDAS PARA SOLICITUDES ======

// Función principal para cargar solicitudes
async function cargarSolicitudesAdmin(tipoFiltro = 'todas') {
    console.log("🔍 Cargando solicitudes con filtro:", tipoFiltro);
    
    const tbody = document.querySelector('#tabla-solicitudes tbody');
    
    if (!tbody) {
        console.error('❌ No se encontró la tabla de solicitudes');
        return;
    }
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 20px;">
                <i class="fas fa-spinner fa-spin"></i> Cargando solicitudes...
            </td>
        </tr>
    `;

    if (!db) {
        alert("❌ Error: Base de datos no disponible");
        return;
    }

    try {
        let query = db.collection('solicitudesRepuestos').orderBy('fecha', 'desc');
        
        if (tipoFiltro === 'pendientes') {
            query = query.where('estado', '==', 'Pendiente');
        } else if (tipoFiltro === 'aceptadas') {
            query = query.where('estado', '==', 'Aceptada');
        } else if (tipoFiltro === 'rechazadas') {
            query = query.where('estado', 'in', ['Rechazada', 'Rechazada - No Existe', 'Rechazada - Stock Insuficiente']);
        }
        
        const querySnapshot = await query.get();
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #7f8c8d;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <div>No hay solicitudes ${obtenerTextoFiltro(tipoFiltro)}.</div>
                    </td>
                </tr>
            `;
            return;
        }

        querySnapshot.forEach(doc => {
            const solicitud = doc.data();
            const docId = doc.id;
            const tr = document.createElement('tr');
            
            const fecha = solicitud.fecha || 'N/A';
            const mecanico = solicitud.mecanico || 'N/A';
            const repuesto = solicitud.repuesto || 'N/A';
            const cantidad = solicitud.cantidad || 0;
            const estado = solicitud.estado || 'N/A';
            
            // SOLUCIÓN: Mostrar botón de eliminar para TODOS los estados excepto pendientes
            let botonesAccion = '';
            if (estado === 'Pendiente') {
                botonesAccion = `
                    <button class="btn-icon btn-icon-accept" onclick="aceptarSolicitud('${docId}', '${repuesto.replace(/'/g, "\\'")}', ${cantidad})" title="Aceptar">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-icon btn-icon-reject" onclick="rechazarSolicitud('${docId}')" title="Rechazar">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            } else {
                botonesAccion = `
                    <button class="btn-icon btn-icon-delete" onclick="eliminarSolicitud('${docId}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            }
            
            tr.innerHTML = `
                <td>${fecha}</td>
                <td>${mecanico}</td>
                <td>${repuesto}</td>
                <td>${cantidad}</td>
                <td><span class="estado-${estado.toLowerCase().replace(/ /g, '-')}">${estado}</span></td>
                <td class="action-buttons-table">${botonesAccion}</td>
            `;
            
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("❌ Error al cargar solicitudes:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i> Error al cargar datos
                </td>
            </tr>
        `;
    }
}

// FUNCIÓN CORREGIDA PARA ELIMINAR SOLICITUDES
async function eliminarSolicitud(docId) {
    console.log("🗑️ Intentando eliminar solicitud:", docId);
    
    if (!confirm('¿Estás seguro de que quieres ELIMINAR permanentemente esta solicitud?\n\nEsta acción no se puede deshacer.')) {
        return;
    }

    if (!db) {
        alert("❌ Error: Base de datos no disponible");
        return;
    }
    
    try {
        // ELIMINAR directamente de Firestore
        await db.collection('solicitudesRepuestos').doc(docId).delete();
        
        alert('✅ Solicitud eliminada exitosamente.');
        
        // Recargar la tabla manteniendo el filtro actual
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
        cargarSolicitudesAdmin(filtroActual);
        
        // Actualizar notificaciones y estadísticas
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("❌ Error al eliminar solicitud:", error);
        alert("❌ Error al eliminar la solicitud: " + error.message);
    }
}

// Función para aceptar solicitud
async function aceptarSolicitud(docId, repuestoNombre, cantidad) {
    if (!db) {
        alert("❌ Error: Base de datos no disponible");
        return;
    }

    try {
        const repuestoQuery = await db.collection('inventario').where('nombre', '==', repuestoNombre).get();
        
        if (repuestoQuery.empty) {
            await db.collection('solicitudesRepuestos').doc(docId).update({
                estado: 'Rechazada - No Existe'
            });
            alert(`❌ El repuesto "${repuestoNombre}" no existe en inventario.`);
        } else {
            const repuestoDoc = repuestoQuery.docs[0];
            const repuestoData = repuestoDoc.data();
            
            if (repuestoData.stock < cantidad) {
                await db.collection('solicitudesRepuestos').doc(docId).update({
                    estado: 'Rechazada - Stock Insuficiente'
                });
                alert(`❌ Stock insuficiente. Stock actual: ${repuestoData.stock}`);
            } else {
                await db.collection('inventario').doc(repuestoDoc.id).update({
                    stock: firebase.firestore.FieldValue.increment(-cantidad)
                });
                
                await db.collection('solicitudesRepuestos').doc(docId).update({
                    estado: 'Aceptada'
                });
                
                alert(`✅ ${cantidad} unidades de ${repuestoNombre} entregadas.`);
            }
        }
        
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
        cargarSolicitudesAdmin(filtroActual);
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("❌ Error:", error);
        alert("❌ Error al procesar la solicitud.");
    }
}

// Función para rechazar solicitud
async function rechazarSolicitud(docId) {
    if (!confirm('¿Estás seguro de que quieres rechazar esta solicitud?')) {
        return;
    }

    if (!db) {
        alert("❌ Error: Base de datos no disponible");
        return;
    }
    
    try {
        await db.collection('solicitudesRepuestos').doc(docId).update({
            estado: 'Rechazada'
        });
        
        alert('❌ Solicitud rechazada.');
        
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
        cargarSolicitudesAdmin(filtroActual);
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("❌ Error:", error);
        alert("❌ Error al rechazar la solicitud.");
    }
}

// Función para filtrar solicitudes
function filtrarSolicitudesPorTipo(tipo) {
    console.log(`🎯 Filtrando por: ${tipo}`);
    
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const botonClickeado = document.getElementById(`btn-${tipo}`);
    if (botonClickeado) {
        botonClickeado.classList.add('active');
    }
    
    cargarSolicitudesAdmin(tipo);
}

// Función auxiliar
function obtenerTextoFiltro(filtro) {
    const textos = {
        'pendientes': 'pendientes',
        'aceptadas': 'aceptadas', 
        'rechazadas': 'rechazadas',
        'todas': ''
    };
    return textos[filtro] || '';
}

// Función auxiliar para texto del filtro
function obtenerTextoFiltro(filtro) {
    const textos = {
        'pendientes': 'pendientes',
        'aceptadas': 'aceptadas', 
        'rechazadas': 'rechazadas',
        'todas': ''
    };
    return textos[filtro] || '';
}

// Función para filtrar por botones
function filtrarSolicitudesPorTipo(tipo) {
    console.log(`🎯 Filtrando solicitudes por: ${tipo}`);
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const botonClickeado = document.getElementById(`btn-${tipo}`);
    if (botonClickeado) {
        botonClickeado.classList.add('active');
    }
    
    // Cargar solicitudes con el filtro
    cargarSolicitudesAdmin(tipo);
}

// ====== FUNCIÓN PARA FILTRAR SOLICITUDES POR BOTONES ======
function filtrarSolicitudesPorTipo(tipo) {
    console.log(`Filtrando por: ${tipo}`);
    
    // Remover clase active de todos los botones
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Agregar clase active al botón clickeado
    const botonClickeado = document.getElementById(`btn-${tipo}`);
    if (botonClickeado) {
        botonClickeado.classList.add('active');
    }
    
    // Cargar las solicitudes con el filtro seleccionado
    cargarSolicitudesAdmin(tipo);
}

// Función auxiliar para texto del filtro
function obtenerTextoFiltro(filtro) {
    switch(filtro) {
        case 'pendientes': return 'pendientes';
        case 'aceptadas': return 'aceptadas';
        case 'rechazadas': return 'rechazadas';
        case 'todas': return '';
        default: return '';
    }
}

// Función auxiliar para texto del filtro
function obtenerTextoFiltro(filtro) {
    const textos = {
        'pendientes': 'pendientes',
        'aceptadas': 'aceptadas', 
        'rechazadas': 'rechazadas',
        'todas': ''
    };
    return textos[filtro] || '';
}

// Función para filtrar por botones
function filtrarSolicitudesPorTipo(tipo) {
    console.log(`🎯 Filtrando solicitudes por: ${tipo}`);
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const botonClickeado = document.getElementById(`btn-${tipo}`);
    if (botonClickeado) {
        botonClickeado.classList.add('active');
    }
    
    // Cargar solicitudes con el filtro
    cargarSolicitudesAdmin(tipo);
}

// Funciones básicas para aceptar/rechazar (placeholders)
async function aceptarSolicitud(docId, repuesto, cantidad) {
    alert(`Función aceptar: ${repuesto} - ${cantidad} unidades`);
    // Implementar lógica completa después
}

async function rechazarSolicitud(docId) {
    if (confirm('¿Estás seguro de que quieres rechazar esta solicitud?')) {
        alert('Solicitud rechazada');
        // Recargar tabla
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
        cargarSolicitudesAdmin(filtroActual);
    }
}

async function eliminarSolicitudIndividual(docId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta solicitud?')) {
        alert('Solicitud eliminada');
        // Recargar tabla  
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
        cargarSolicitudesAdmin(filtroActual);
    }
}

// ====== FUNCIONES PARA ACEPTAR Y RECHAZAR SOLICITUDES ======
async function aceptarSolicitud(docId, repuestoNombre, cantidad) {
    if (!db) {
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        // Buscar el repuesto en inventario
        const repuestoQuery = await db.collection('inventario').where('nombre', '==', repuestoNombre).get();
        
        if (repuestoQuery.empty) {
            // Si no existe el repuesto
            await db.collection('solicitudesRepuestos').doc(docId).update({
                estado: 'Rechazada - No Existe'
            });
            alert(`Solicitud rechazada: El repuesto "${repuestoNombre}" no existe en inventario.`);
        } else {
            const repuestoDoc = repuestoQuery.docs[0];
            const repuestoData = repuestoDoc.data();
            
            if (repuestoData.stock < cantidad) {
                // Si no hay stock suficiente
                await db.collection('solicitudesRepuestos').doc(docId).update({
                    estado: 'Rechazada - Stock Insuficiente'
                });
                alert(`Solicitud rechazada: Stock insuficiente. Stock actual: ${repuestoData.stock}, solicitado: ${cantidad}`);
            } else {
                // Aceptar la solicitud y actualizar stock
                await db.collection('inventario').doc(repuestoDoc.id).update({
                    stock: firebase.firestore.FieldValue.increment(-cantidad)
                });
                
                await db.collection('solicitudesRepuestos').doc(docId).update({
                    estado: 'Aceptada'
                });
                
                alert(`Solicitud aceptada: ${cantidad} unidades de ${repuestoNombre} entregadas.`);
            }
        }
        
        // Recargar la tabla
        const botonActivo = document.querySelector('.filter-buttons .btn.active');
        const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
        cargarSolicitudesAdmin(filtroActual);
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("Error al procesar solicitud:", error);
        alert("Hubo un error al procesar la solicitud.");
    }
}

async function rechazarSolicitud(docId) {
    if (confirm('¿Estás seguro de que quieres rechazar esta solicitud?')) {
        if (!db) {
            alert("El sistema no está listo. Intente nuevamente.");
            return;
        }
        
        try {
            await db.collection('solicitudesRepuestos').doc(docId).update({
                estado: 'Rechazada'
            });
            
            alert('Solicitud rechazada.');
            
            // Recargar la tabla
            const botonActivo = document.querySelector('.filter-buttons .btn.active');
            const filtroActual = botonActivo ? botonActivo.id.replace('btn-', '') : 'todas';
            cargarSolicitudesAdmin(filtroActual);
            verificarSolicitudesPendientes();
            actualizarEstadisticas();
            
        } catch (error) {
            console.error("Error al rechazar solicitud:", error);
            alert("Hubo un error al rechazar la solicitud.");
        }
    }
}

// ====== INICIALIZACIÓN DEL SISTEMA ======
// En la función de inicialización del sistema
document.addEventListener('DOMContentLoaded', async () => {
    const firebaseInitialized = await initializeFirebase();
    
    if (!firebaseInitialized) {
        alert("Hubo un problema al cargar el sistema. Por favor, intente de nuevo o contacte al soporte.");
        return;
    }
    document.querySelector('#login .btn-primary').addEventListener('click', login);
    document.getElementById('entrada-nombre').addEventListener('input', autocompletarCodigoEntrada);
    document.getElementById('entrada-nombre').addEventListener('input', sugerirNombresEntrada);
    document.getElementById('entrada-nombre').addEventListener('blur', () => {
        const cont = document.getElementById('entrada-nombre-sugerencias');
        if (cont) setTimeout(() => { cont.style.display = 'none'; }, 150);
    });
    document.getElementById('salida-nombre').addEventListener('input', autocompletarCodigoSalida);
    document.getElementById('salida-nombre').addEventListener('input', sugerirNombresSalida);
    document.getElementById('salida-nombre').addEventListener('blur', () => {
        const cont = document.getElementById('salida-nombre-sugerencias');
        if (cont) setTimeout(() => { cont.style.display = 'none'; }, 150);
    });
    document.getElementById('nuevo-codigo').addEventListener('input', autocompletarNombreAgregarProducto);
    document.getElementById('solicitar-codigo').addEventListener('input', autocompletarNombreSolicitud);
    const solNombre = document.getElementById('solicitar-nombre');
    if (solNombre) {
        solNombre.addEventListener('input', autocompletarCodigoSolicitud);
        solNombre.addEventListener('input', sugerirNombresSolicitud);
        solNombre.addEventListener('blur', () => {
            const cont = document.getElementById('solicitar-nombre-sugerencias');
            if (cont) setTimeout(() => { cont.style.display = 'none'; }, 150);
        });
    }

    document.getElementById('form-entrada').addEventListener('submit', agregarEntrada);
    document.getElementById('form-salida').addEventListener('submit', agregarSalida);
    document.getElementById('form-agregar-producto').addEventListener('submit', agregarNuevoProducto);
    document.getElementById('form-solicitar-repuesto').addEventListener('submit', solicitarRepuesto);
    const solBtn = document.querySelector('#form-solicitar-repuesto button[type="submit"]');
    if (solBtn) {
        solBtn.addEventListener('click', (e) => {
            e.preventDefault();
            solicitarRepuesto(e);
        });
    }

    // Botón Exportar PDF (opcional)
    const btnExportPDF = document.getElementById('btn-exportar-pdf');
});

// ====== UTILIDAD: EXPORTAR PDF DE REPORTES ======
async function exportarReportePDF() {
    try {
        const JSPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!JSPDF || !window.html2canvas) {
            alert('No se encontraron librerías de exportación (jsPDF/html2canvas).');
            return;
        }

        const contenedor = document.getElementById('apartado-reportes');
        if (!contenedor) {
            alert('No se encontró la sección de reportes.');
            return;
        }

        const estabaOculto = contenedor.style.display === 'none' || getComputedStyle(contenedor).display === 'none';
        if (estabaOculto) {
            if (typeof mostrarApartado === 'function') {
                mostrarApartado('reportes');
            }
        } else {
            if (typeof generarReportes === 'function') {
                await generarReportes();
            }
        }

        contenedor.scrollIntoView({ behavior: 'auto', block: 'start' });
        await new Promise(r => setTimeout(r, 500));

        const size = 'a4';
        const orientation = 'portrait';
        const margin = 10; // pt
        const maxPages = 2;

        const prevBg = contenedor.style.backgroundColor;
        contenedor.style.backgroundColor = '#ffffff';

        // Reemplazar canvases (gráficos) por imágenes para evitar lienzos vacíos en PDF
        const canvasNodes = Array.from(contenedor.querySelectorAll('canvas'));
        const swaps = [];
        for (const c of canvasNodes) {
            try {
                const dataUrl = c.toDataURL('image/png');
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.maxWidth = '100%';
                img.style.display = 'block';
                c.parentNode.insertBefore(img, c);
                c.style.display = 'none';
                swaps.push({ canvas: c, img });
            } catch (e) {
                console.warn('No se pudo convertir canvas a imagen, se captura directo:', e);
            }
        }

        const canvas = await html2canvas(contenedor, {
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            scrollY: 0,
            scale: 2,
            imageTimeout: 0,
            removeContainer: true
        });

        contenedor.style.backgroundColor = prevBg || '';

        // Restaurar canvases
        for (const swap of swaps) {
            swap.canvas.style.display = '';
            if (swap.img.parentNode) swap.img.parentNode.removeChild(swap.img);
        }

        const pdf = new JSPDF({ orientation, unit: 'pt', format: size });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;

        const srcWidth = canvas.width;
        const srcHeight = canvas.height;
        const scale = availableWidth / srcWidth; // escalar a ancho de página

        // Slicing: convertir la imagen en varias páginas usando trozos de canvas
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = srcWidth;
        // Altura en px que cabe por página a la escala elegida
        const pxPerPage = Math.floor(availableHeight / scale);
        const totalPages = Math.max(1, Math.ceil(srcHeight / pxPerPage));
        const pagesToRender = Math.min(totalPages, maxPages);

        for (let page = 0; page < pagesToRender; page++) {
            const srcY = page * pxPerPage;
            const sliceHeight = Math.min(pxPerPage, srcHeight - srcY);
            tempCanvas.height = sliceHeight;
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, srcY, srcWidth, sliceHeight, 0, 0, srcWidth, sliceHeight);

            const sliceImg = tempCanvas.toDataURL('image/png');
            const slicePdfHeight = sliceHeight * scale;
            const x = (pageWidth - availableWidth) / 2; // centrar horizontalmente
            const y = margin; // margen superior consistente

            if (page > 0) pdf.addPage();
            pdf.addImage(sliceImg, 'PNG', x, y, availableWidth, slicePdfHeight, undefined, 'FAST');
        }

        pdf.save('reporte.pdf');

        // Volver a la vista principal si estaba oculta
        if (estabaOculto && typeof mostrarApartado === 'function') {
            mostrarApartado('');
        }

        alert('PDF generado correctamente.');
    } catch (err) {
        console.error('Error al exportar PDF:', err);
        alert('No se pudo generar el PDF.');
    }
}