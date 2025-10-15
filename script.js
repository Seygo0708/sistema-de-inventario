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

    if ((role === 'admin' && username === 'admin' && password === '12456') ||
        (role === 'Usuario' && username === 'mecanico' && password === '123456')) {
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
            cargarSolicitudesAdmin();
        } else if (nombre === 'reportes') {
            // Inicializar reportes si es la primera vez
            if (Object.keys(chartInstances).length === 0) {
                inicializarReportes();
            }
            generarReportes(); // Generar reportes automáticamente al entrar
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

// --- FUNCIONES CRUD ---
async function agregarNuevoProducto(event) {
    event.preventDefault();

    const codigo = document.getElementById('nuevo-codigo').value.trim().toUpperCase();
    const nombre = document.getElementById('nuevo-nombre').value.trim().toUpperCase();
    const costoUnitario = parseFloat(document.getElementById('nuevo-costo-unitario').value);
    const precioVenta = parseFloat(document.getElementById('nuevo-precio-venta').value);
    const stock = parseInt(document.getElementById('nuevo-stock').value);
    const lote = document.getElementById('nuevo-lote').value.trim();
    const fechaActualizacion = document.getElementById('nuevo-producto-fecha').value;

    if (!codigo || !nombre || isNaN(stock) || stock < 0 || isNaN(costoUnitario) || isNaN(precioVenta) || !fechaActualizacion) {
        alert('Por favor complete todos los campos obligatorios correctamente.');
        return;
    }

    if (!db) {
        console.error("Firestore no está inicializado (agregarNuevoProducto)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }
    
    try {
        const existeCodigoQuery = await db.collection('inventario').where('codigo', '==', codigo).get();
        if (!existeCodigoQuery.empty) {
            alert('Ya existe un producto con este código.');
            return;
        }
        
        const existeNombreQuery = await db.collection('inventario').where('nombre', '==', nombre).get();
        if (!existeNombreQuery.empty) {
            alert('Ya existe un producto con este nombre.');
            return;
        }

        await db.collection('inventario').add({
            codigo: codigo,
            nombre: nombre,
            lote: lote,
            costoUnitario: costoUnitario.toFixed(2),
            precioVenta: precioVenta.toFixed(2),
            stock: stock,
            fechaActualizacion: fechaActualizacion
        });

        alert(`Producto "${nombre}" agregado exitosamente a la base de datos.`);
        document.getElementById('form-agregar-producto').reset();
        document.getElementById('nuevo-producto-fecha').valueAsDate = new Date();
        cargarInventarioCompleto();
        verificarStockBajo();
        actualizarEstadisticas();
    } catch (error) {
        console.error("Error al agregar producto: ", error);
        alert("Hubo un error al guardar el producto.");
    }
}

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
    
    const nombre = document.getElementById('solicitar-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('solicitar-cantidad').value);
    const usuarioMecanico = 'mecanico'; // Asumimos que el usuario actual es "mecanico"

    if (!nombre || isNaN(cantidad) || cantidad <= 0) {
        alert('Por favor, ingrese un nombre de repuesto y una cantidad válida.');
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
            repuesto: nombre,
            cantidad: cantidad,
            estado: 'Pendiente'
        });

        alert(`Su solicitud de ${cantidad} unidades de ${nombre} ha sido enviada al administrador.`);
        document.getElementById('form-solicitar-repuesto').reset();
        
    } catch (error) {
        console.error("Error al registrar la solicitud:", error);
        alert("Hubo un error al enviar la solicitud.");
    }
}

// --- FUNCIONES DEL ADMINISTRADOR PARA SOLICITUDES ---
async function cargarSolicitudesAdmin() {
    const tbody = document.querySelector('#tabla-solicitudes tbody');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    
    if (!db) {
        tbody.innerHTML = '<tr><td colspan="6">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarSolicitudesAdmin)");
        return;
    }

    try {
        const querySnapshot = await db.collection('solicitudesRepuestos').orderBy('fecha', 'desc').get();
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6">No hay solicitudes pendientes.</td></tr>';
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
                <td><span class="estado-${solicitud.estado.toLowerCase()}">${solicitud.estado}</span></td>
                <td class="action-buttons-table">
                    ${solicitud.estado === 'Pendiente' ? 
                    `<button class="btn btn-success btn-sm" onclick="aceptarSolicitud('${docId}', '${solicitud.repuesto}', ${solicitud.cantidad})">Aceptar</button>
                    <button class="btn btn-danger btn-sm" onclick="rechazarSolicitud('${docId}')">Rechazar</button>`
                    : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar solicitudes:", error);
        tbody.innerHTML = '<tr><td colspan="6">Error al cargar datos.</td></tr>';
    }
}

async function aceptarSolicitud(solicitudId, nombreRepuesto, cantidad) {
    if (!db) {
        console.error("Firestore no está inicializado (aceptarSolicitud)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        const querySnapshot = await db.collection('inventario').where('nombre', '==', nombreRepuesto).get();

        if (querySnapshot.empty) {
            alert(`El repuesto "${nombreRepuesto}" no se encuentra en el inventario. Por favor, añádalo primero.`);
            await db.collection('solicitudesRepuestos').doc(solicitudId).update({ estado: 'Rechazada - No Existe' });
            cargarSolicitudesAdmin();
            return;
        }

        const productoDoc = querySnapshot.docs[0];
        const productoData = productoDoc.data();

        if (productoData.stock < cantidad) {
            alert(`Stock insuficiente para "${nombreRepuesto}". Stock actual: ${productoData.stock}. La solicitud será rechazada.`);
            await db.collection('solicitudesRepuestos').doc(solicitudId).update({ estado: 'Rechazada - Stock Insuficiente' });
            cargarSolicitudesAdmin();
            return;
        }

        // Si el stock es suficiente, actualizamos el inventario y la solicitud
        await db.collection('inventario').doc(productoDoc.id).update({
            stock: firebase.firestore.FieldValue.increment(-cantidad)
        });

        await db.collection('solicitudesRepuestos').doc(solicitudId).update({
            estado: 'Aceptada'
        });

        alert(`Solicitud de ${nombreRepuesto} aceptada. Se ha descontado ${cantidad} unidad(es) del stock.`);
        cargarSolicitudesAdmin();
        verificarStockBajo();
        verificarSolicitudesPendientes();
        cargarInventarioCompleto();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("Error al aceptar solicitud:", error);
        alert("Hubo un error al procesar la solicitud.");
    }
}

async function rechazarSolicitud(solicitudId) {
    if (!db) {
        console.error("Firestore no está inicializado (rechazarSolicitud)");
        alert("El sistema no está listo. Intente nuevamente.");
        return;
    }

    try {
        await db.collection('solicitudesRepuestos').doc(solicitudId).update({
            estado: 'Rechazada'
        });

        alert('Solicitud rechazada.');
        cargarSolicitudesAdmin();
        verificarSolicitudesPendientes();
        actualizarEstadisticas();
        
    } catch (error) {
        console.error("Error al rechazar solicitud:", error);
        alert("Hubo un error al rechazar la solicitud.");
    }
}

async function verificarSolicitudesPendientes() {
    if (isCheckingSolicitudes) {
        console.log("Ya se están verificando las solicitudes. Ignorando llamada duplicada.");
        return;
    }
    
    isCheckingSolicitudes = true;
    
    const solicitudList = document.getElementById('solicitud-list');
    const notificationContainer = document.getElementById('solicitud-notification-container');
    
    solicitudList.innerHTML = '';
    notificationContainer.style.display = 'none';

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

        if (solicitudesPendientes.length > 0) {
            solicitudesPendientes.forEach(solicitud => {
                const li = document.createElement('li');
                li.textContent = `- ${solicitud.repuesto} (Cantidad: ${solicitud.cantidad})`;
                solicitudList.appendChild(li);
            });
            notificationContainer.style.display = 'block';
        } else {
            notificationContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("Error al verificar solicitudes pendientes:", error);
    } finally {
        isCheckingSolicitudes = false;
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
                    <button class="btn btn-warning btn-sm" onclick="actualizarSalida('${doc.id}')">Actualizar</button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarSalida('${doc.id}', '${item.repuesto}', ${item.cantidad})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar repuestos de salida: ", error);
        tbody.innerHTML = '<tr><td colspan="8">Error al cargar datos.</td></tr>';
    }
}

async function cargarHistorialEntradas() {
    const tbody = document.querySelector('#tabla-entradas-historial tbody');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

    if (!db) {
        tbody.innerHTML = '<tr><td colspan="4">Error: Firestore no está inicializado.</td></tr>';
        console.error("Firestore no está inicializado (cargarHistorialEntradas)");
        return;
    }

    try {
        const querySnapshot = await db.collection('historialEntradas').orderBy('fecha', 'desc').get();
        tbody.innerHTML = '';

        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4">No hay entradas registradas.</td></tr>';
            return;
        }

        querySnapshot.forEach(doc => {
            const item = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.fecha}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar historial de entradas: ", error);
        tbody.innerHTML = '<tr><td colspan="4">Error al cargar datos.</td></tr>';
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
                    <button class="btn btn-warning btn-sm" onclick="actualizarProducto('${doc.id}')">Actualizar</button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto('${doc.id}', '${item.nombre}')">Eliminar</button>
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

        const nuevaCantidad = prompt(`Actualizar cantidad (actual: ${salida.cantidad}):`, salida.cantidad);
        if (nuevaCantidad === null || isNaN(parseInt(nuevaCantidad))) {
            alert('Actualización cancelada o cantidad no válida.');
            return;
        }
        const cantidadInt = parseInt(nuevaCantidad);

        const nuevoCliente = prompt(`Actualizar nombre del cliente (actual: ${salida.cliente}):`, salida.cliente);
        if (nuevoCliente === null || nuevoCliente.trim() === '') {
            alert('Actualización cancelada.');
            return;
        }
        
        await docRef.update({
            cantidad: cantidadInt,
            cliente: nuevoCliente.trim()
        });
        
        alert(`Salida de ${salida.repuesto} actualizada exitosamente.`);
        cargarRepuestosSalida(); 

    } catch (error) {
        console.error("Error al actualizar la salida: ", error);
        alert("Hubo un error al actualizar el registro de salida.");
    }
}

async function eliminarSalida(docId, nombreRepuesto, cantidad) {
    if (confirm(`¿Estás seguro de que quieres eliminar la salida de ${cantidad} unidades de "${nombreRepuesto}"?`)) {
        if (!db) {
            console.error("Firestore no está inicializado (eliminarSalida)");
            alert("El sistema no está listo. Intente nuevamente.");
            return;
        }

        try {
            const inventarioQuery = await db.collection('inventario').where('nombre', '==', nombreRepuesto).limit(1).get();
            if (!inventarioQuery.empty) {
                const productoDoc = inventarioQuery.docs[0];
                await db.collection('inventario').doc(productoDoc.id).update({
                    stock: firebase.firestore.FieldValue.increment(cantidad)
                });
            }
            
            await db.collection('repuestosSalida').doc(docId).delete();
            
            alert('Salida eliminada exitosamente y stock restablecido.');
            cargarRepuestosSalida();
            cargarInventarioCompleto();
            verificarStockBajo();
            actualizarEstadisticas();

        } catch (error) {
            console.error("Error al eliminar la salida: ", error);
            alert("Hubo un error al eliminar el registro de salida.");
        }
    }
}

// ====== SISTEMA DE REPORTES Y GRÁFICOS ======

// Función para inicializar la sección de reportes
function inicializarReportes() {
    // Crear instancias de gráficos vacías (solo los que quedan)
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
        }
    };

    // Inicializar solo los gráficos que quedan
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

// ====== FUNCIÓN PARA EXPORTAR GRÁFICOS COMO PDF ======
async function exportarGraficosPDF() {
    // Mostrar mensaje de carga
    alert("Generando PDF con los gráficos... Esto puede tardar unos segundos.");
    
    try {
        // Array de gráficos a exportar
        const graficos = [
            { id: 'chartMovimientosDia', nombre: 'Movimientos por Día' },
            { id: 'chartProductosMovimientos', nombre: 'Productos con Más Movimientos' },
            { id: 'chartDistribucionStock', nombre: 'Distribución de Stock' },
            { id: 'chartTendenciaMensual', nombre: 'Tendencia Mensual de Movimientos' }
        ];
        
        // Crear un contenedor temporal para las imágenes
        const contenedorTemporal = document.createElement('div');
        contenedorTemporal.style.position = 'absolute';
        contenedorTemporal.style.left = '-9999px';
        document.body.appendChild(contenedorTemporal);
        
        // Crear título del reporte
        const titulo = document.createElement('h1');
        titulo.textContent = 'Reporte de Gráficos - Sistema de Inventario';
        titulo.style.textAlign = 'center';
        titulo.style.color = '#4361ee';
        titulo.style.marginBottom = '20px';
        titulo.style.fontFamily = 'Arial, sans-serif';
        contenedorTemporal.appendChild(titulo);
        
        // Fecha del reporte
        const fecha = document.createElement('p');
        fecha.textContent = `Generado el: ${new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        fecha.style.textAlign = 'center';
        fecha.style.color = '#666';
        fecha.style.marginBottom = '30px';
        fecha.style.fontFamily = 'Arial, sans-serif';
        contenedorTemporal.appendChild(fecha);
        
        // Capturar cada gráfico como imagen
        for (const grafico of graficos) {
            const canvas = document.getElementById(grafico.id);
            if (!canvas) {
                console.warn(`No se encontró el canvas: ${grafico.id}`);
                continue;
            }
            
            // Crear contenedor para el gráfico
            const contenedorGrafico = document.createElement('div');
            contenedorGrafico.style.marginBottom = '40px';
            contenedorGrafico.style.textAlign = 'center';
            
            // Título del gráfico
            const tituloGrafico = document.createElement('h3');
            tituloGrafico.textContent = grafico.nombre;
            tituloGrafico.style.color = '#333';
            tituloGrafico.style.marginBottom = '15px';
            tituloGrafico.style.fontFamily = 'Arial, sans-serif';
            contenedorGrafico.appendChild(tituloGrafico);
            
            // Crear imagen del canvas
            const imagen = new Image();
            imagen.src = canvas.toDataURL('image/png');
            imagen.style.maxWidth = '600px';
            imagen.style.height = 'auto';
            imagen.style.border = '1px solid #ddd';
            imagen.style.borderRadius = '8px';
            imagen.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            
            contenedorGrafico.appendChild(imagen);
            contenedorTemporal.appendChild(contenedorGrafico);
        }
        
        // Usar html2pdf para generar el PDF
        const opciones = {
            margin: [10, 10, 10, 10],
            filename: `reporte_graficos_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            }
        };
        
        // Generar PDF
        await html2pdf().set(opciones).from(contenedorTemporal).save();
        
        // Limpiar contenedor temporal
        document.body.removeChild(contenedorTemporal);
        
        alert("PDF generado exitosamente!");
        
    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("Error al generar el PDF. Asegúrese de tener conexión a internet.");
    }
}

// Función principal para generar reportes
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
        
        const entradasFiltradas = entradasData.docs.filter(doc => 
            !fechaLimite || new Date(doc.data().fecha) >= fechaLimite
        );
        
        const salidasFiltradas = salidasData.docs.filter(doc => 
            !fechaLimite || new Date(doc.data().fecha) >= fechaLimite
        );
        
        const solicitudesFiltradas = solicitudesData.docs.filter(doc => 
            !fechaLimite || new Date(doc.data().fecha) >= fechaLimite
        );

        // Generar todos los gráficos (solo los que quedan)
        generarGraficoMovimientosDia(entradasFiltradas, salidasFiltradas);
        generarGraficoProductosMovimientos(entradasFiltradas, salidasFiltradas);
        generarGraficoDistribucionStock(inventarioData);
        generarGraficoTendenciaMensual(entradasFiltradas, salidasFiltradas);
        
        // Actualizar estadísticas resumen
        actualizarEstadisticasResumen(
            entradasFiltradas, 
            salidasFiltradas, 
            solicitudesFiltradas, 
            inventarioData
        );

    } catch (error) {
        console.error("Error al generar reportes:", error);
        alert("Error al generar los reportes estadísticos.");
    }
}

// Función para calcular fecha límite según período
function calcularFechaLimite(periodo) {
    if (periodo === 'todo') return null;
    
    const dias = parseInt(periodo);
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return fecha;
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

// ====== INICIALIZACIÓN DEL SISTEMA ======
document.addEventListener('DOMContentLoaded', async () => {
    const firebaseInitialized = await initializeFirebase();
    
    if (!firebaseInitialized) {
        alert("Hubo un problema al cargar el sistema. Por favor, intente de nuevo o contacte al soporte.");
        return;
    }
    
    // Configurar event listeners
    document.querySelector('#login .btn-primary').addEventListener('click', login);
    document.getElementById('entrada-codigo').addEventListener('input', autocompletarNombreEntrada);
    document.getElementById('salida-codigo').addEventListener('input', autocompletarNombreSalida);
    document.getElementById('nuevo-codigo').addEventListener('input', autocompletarNombreAgregarProducto);
    document.getElementById('form-entrada').addEventListener('submit', agregarEntrada);
    document.getElementById('form-salida').addEventListener('submit', agregarSalida);
    document.getElementById('form-agregar-producto').addEventListener('submit', agregarNuevoProducto);
    document.getElementById('form-solicitar-repuesto').addEventListener('submit', solicitarRepuesto);
});