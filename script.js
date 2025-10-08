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

// Función para cambiar avatar según el rol seleccionado
function configurarCambioAvatar() {
  const roleInputs = document.querySelectorAll('input[name="role"]');
  const avatarImg = document.getElementById('avatar-img');
  roleInputs.forEach(input => {
    input.addEventListener('change', function() {
      if (this.value === "Usuario") {
        avatarImg.src = "mecanico.gif";
      } else if (this.value === "admin") {
        avatarImg.src = "admin.gif";
      }
    });
  });
}

// --- FUNCIONES DEL SISTEMA ---
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.querySelector('input[name="role"]:checked')?.value;

    if (!role || username === '' || password === '') {
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
    document.getElementById('avatar-img').src = "avatar.png";
    document.querySelectorAll('input[name="role"]').forEach(r => r.checked = false);
}

function mostrarApartado(nombre) {
    const secciones = document.querySelectorAll('.admin-section');
    secciones.forEach(sec => sec.style.display = 'none');

    const menuIconos = document.querySelector('.admin-icon-menu');
    const stockNotification = document.getElementById('stock-notification-container');
    const solicitudNotification = document.getElementById('solicitud-notification-container');

    if (nombre === '') {
        menuIconos.style.display = 'grid';
        stockNotification.style.display = 'block';
        solicitudNotification.style.display = 'block';
        verificarStockBajo();
        verificarSolicitudesPendientes();
    } else {
        menuIconos.style.display = 'none';
        stockNotification.style.display = 'none';
        solicitudNotification.style.display = 'none';
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
        }
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
    if (!db) return console.error("Firestore no inicializado");
    try {
        const q = await db.collection('inventario').where('codigo', '==', codigoBusqueda).limit(1).get();
        nombreInput.value = q.empty ? '' : q.docs[0].data().nombre;
    } catch (err) { console.error(err); nombreInput.value = ''; }
}
const autocompletarNombreEntrada = () => autocompletarNombreGenerico('entrada-codigo', 'entrada-nombre');
const autocompletarNombreSalida = () => autocompletarNombreGenerico('salida-codigo', 'salida-nombre');
const autocompletarNombreAgregarProducto = () => autocompletarNombreGenerico('nuevo-codigo', 'nuevo-nombre');

// --- CRUD: INVENTARIO ---
async function agregarNuevoProducto(e) {
    e.preventDefault();
    const codigo = document.getElementById('nuevo-codigo').value.trim().toUpperCase();
    const nombre = document.getElementById('nuevo-nombre').value.trim().toUpperCase();
    const costo = parseFloat(document.getElementById('nuevo-costo-unitario').value);
    const precio = parseFloat(document.getElementById('nuevo-precio-venta').value);
    const stock = parseInt(document.getElementById('nuevo-stock').value);
    const lote = document.getElementById('nuevo-lote').value.trim();
    const fecha = document.getElementById('nuevo-producto-fecha').value;

    if (!codigo || !nombre || isNaN(stock) || isNaN(costo) || isNaN(precio) || !fecha) {
        alert("Complete todos los campos correctamente."); return;
    }
    if (!db) return alert("Firestore no inicializado");

    try {
        const existe = await db.collection('inventario').where('codigo', '==', codigo).get();
        if (!existe.empty) return alert("Código ya existe.");

        await db.collection('inventario').add({
            codigo, nombre, lote, costoUnitario: costo.toFixed(2), precioVenta: precio.toFixed(2),
            stock, fechaActualizacion: fecha
        });
        alert(`Producto ${nombre} agregado.`);
        e.target.reset(); document.getElementById('nuevo-producto-fecha').valueAsDate = new Date();
        cargarInventarioCompleto(); verificarStockBajo();
    } catch (err) { console.error(err); alert("Error al guardar producto."); }
}

// --- ENTRADAS ---
async function agregarEntrada(e) {
    e.preventDefault();
    const codigo = document.getElementById('entrada-codigo').value.trim().toUpperCase();
    const cantidad = parseInt(document.getElementById('entrada-cantidad').value);
    const fecha = document.getElementById('entrada-fecha').value;
    if (!codigo || isNaN(cantidad) || cantidad <= 0 || !fecha) return alert("Datos inválidos.");

    if (!db) return alert("Firestore no inicializado.");
    try {
        const q = await db.collection('inventario').where('codigo', '==', codigo).get();
        if (q.empty) return alert("Producto no encontrado.");

        const docRef = q.docs[0];
        const prod = docRef.data();
        await db.collection('inventario').doc(docRef.id).update({
            stock: firebase.firestore.FieldValue.increment(cantidad),
            fechaActualizacion: fecha
        });
        await db.collection('historialEntradas').add({ fecha, codigo, nombre: prod.nombre, cantidad });
        alert(`Entrada registrada: ${cantidad} unidades de ${prod.nombre}`);
        e.target.reset(); cargarInventarioCompleto(); verificarStockBajo();
    } catch (err) { console.error(err); alert("Error al registrar entrada."); }
}

// --- SALIDAS ---
async function agregarSalida(e) {
    e.preventDefault();
    const codigo = document.getElementById('salida-codigo').value.trim().toUpperCase();
    const cantidad = parseInt(document.getElementById('salida-cantidad').value);
    const cliente = document.getElementById('salida-cliente').value.trim();
    const ot = document.getElementById('salida-numero-ot').value.trim();
    const placa = document.getElementById('salida-placa').value.trim();
    const km = document.getElementById('salida-kilometraje').value || 0;

    if (!codigo || !cliente || !ot || isNaN(cantidad) || cantidad <= 0)
        return alert("Complete los campos correctamente.");

    if (!db) return alert("Firestore no inicializado.");
    try {
        const q = await db.collection('inventario').where('codigo', '==', codigo).get();
        if (q.empty) return alert("Producto no encontrado.");
        const docRef = q.docs[0];
        const prod = docRef.data();
        if (prod.stock < cantidad) return alert("Stock insuficiente.");

        const fecha = new Date().toISOString().slice(0, 10);
        await db.collection('inventario').doc(docRef.id).update({
            stock: firebase.firestore.FieldValue.increment(-cantidad),
            fechaActualizacion: fecha
        });
        await db.collection('repuestosSalida').add({
            fecha, repuesto: prod.nombre, cliente, numeroOT: ot, cantidad, placa, kilometraje: km
        });
        alert(`Salida registrada: ${cantidad} unidades de ${prod.nombre}`);
        e.target.reset(); cargarInventarioCompleto(); verificarStockBajo();
    } catch (err) { console.error(err); alert("Error al registrar salida."); }
}

// --- STOCK BAJO ---
async function verificarStockBajo() {
    if (isCheckingStock) return;
    isCheckingStock = true;
    const list = document.getElementById('stock-low-list');
    const notif = document.getElementById('stock-notification-container');
    list.innerHTML = ''; notif.style.display = 'none';
    if (!db) return;
    try {
        const q = await db.collection('inventario').get();
        const bajos = [];
        q.forEach(d => { if (d.data().stock <= 5) bajos.push(d.data()); });
        if (bajos.length) {
            bajos.forEach(p => {
                const li = document.createElement('li');
                li.textContent = `- ${p.nombre} (Stock: ${p.stock})`;
                list.appendChild(li);
            });
            notif.style.display = 'block';
        }
    } catch (err) { console.error(err); }
    isCheckingStock = false;
}

// --- EXPORTAR EXCEL ---
async function exportarExcel() {
    alert("Generando reporte...");
    if (!db) return alert("Firestore no inicializado.");
    const wb = XLSX.utils.book_new();
    try {
        const inventario = await db.collection('inventario').get();
        const datos = inventario.docs.map(d => d.data());
        const ws = XLSX.utils.json_to_sheet(datos);
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
        XLSX.writeFile(wb, 'Reporte_Inventario.xlsx');
        alert("Reporte generado.");
    } catch (err) { console.error(err); alert("Error exportando Excel."); }
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    const ok = await initializeFirebase();
    if (!ok) return alert("Error al iniciar Firebase.");
    configurarCambioAvatar();
    document.querySelector('#login button').addEventListener('click', login);
    document.getElementById('entrada-codigo').addEventListener('input', autocompletarNombreEntrada);
    document.getElementById('salida-codigo').addEventListener('input', autocompletarNombreSalida);
    document.getElementById('nuevo-codigo').addEventListener('input', autocompletarNombreAgregarProducto);
    document.getElementById('form-entrada').addEventListener('submit', agregarEntrada);
    document.getElementById('form-salida').addEventListener('submit', agregarSalida);
    document.getElementById('form-agregar-producto').addEventListener('submit', agregarNuevoProducto);
});
