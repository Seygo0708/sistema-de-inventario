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

window.onload = () => {
    initializeFirebase();
};


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
//// ========= SISTEMA IA - PREDICCIÓN INTELIGENTE =========
function inicializarIA() {
    document.getElementById('ia-dias-analisis').value = 60;
    document.getElementById('ia-dias-cobertura').value = 45;
    document.getElementById('ia-leadtime').value = 7;
    document.getElementById('ia-seguridad').value = 25;
    document.getElementById('ia-stock-minimo').value = 3;
}

async function calcularIAStockMejorado() {
    // Verificar que Firebase esté inicializado
    if (!db) {
        alert("❌ Error: La base de datos no está disponible. Intentando reconectar...");
        const initialized = await initializeFirebase();
        if (!initialized) {
            alert("❌ No se pudo conectar a la base de datos. Verifica tu conexión.");
            return;
        }
    }

    const diasAnalisis  = Number(document.getElementById('ia-dias-analisis').value || 60);
    const diasCobertura = Number(document.getElementById('ia-dias-cobertura').value || 45);
    const leadTime      = Number(document.getElementById('ia-leadtime').value || 7);
    const seguridadPct  = Number(document.getElementById('ia-seguridad').value || 25) / 100;
    const stockMinimo   = Number(document.getElementById('ia-stock-minimo').value || 3);

    try {
        // Mostrar loading
        const tbody = document.querySelector('#tabla-ia-resultados tbody');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Analizando datos...</td></tr>';

        // Obtener datos completos
        const [salidasData, entradasData, stockData] = await Promise.all([
            obtenerSalidasCompletas(diasAnalisis),
            obtenerEntradasCompletas(diasAnalisis),
            obtenerStockActualCompleto()
        ]);

        // Procesar análisis avanzado
        const analisis = analisisAvanzadoStock(
            salidasData, 
            entradasData, 
            stockData, 
            diasAnalisis,
            diasCobertura,
            leadTime,
            seguridadPct,
            stockMinimo
        );

        // Mostrar resultados
        mostrarResultadosIA(analisis);
        mostrarMetricasIA(analisis.metricas);
        generarAlertasIA(analisis.alertas);

    } catch (error) {
        console.error("Error en IA:", error);
        alert("❌ Error al calcular predicciones: " + error.message);
        
        // Mostrar error en la tabla
        const tbody = document.querySelector('#tabla-ia-resultados tbody');
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: #e74c3c;">
            <i class="fas fa-exclamation-triangle"></i> Error: ${error.message}
        </td></tr>`;
    }
}

// ========= FUNCIONES DE ANÁLISIS MEJORADAS =========
async function obtenerSalidasCompletas(dias) {
    if (!db) {
        throw new Error("Base de datos no disponible");
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    
    const snapshot = await db.collection('repuestosSalida')
        .where('fecha', '>=', fechaLimite.toISOString().split('T')[0])
        .get();
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            fecha: new Date(data.fecha),
            producto: data.repuesto,
            cantidad: data.cantidad,
            tipo: 'salida'
        };
    });
}

async function obtenerEntradasCompletas(dias) {
    if (!db) {
        throw new Error("Base de datos no disponible");
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    
    const snapshot = await db.collection('historialEntradas')
        .where('fecha', '>=', fechaLimite.toISOString().split('T')[0])
        .get();
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            fecha: new Date(data.fecha),
            producto: data.nombre,
            cantidad: data.cantidad,
            tipo: 'entrada'
        };
    });
}

async function obtenerStockActualCompleto() {
    if (!db) {
        throw new Error("Base de datos no disponible");
    }

    const snapshot = await db.collection('inventario').get();
    const stockMap = new Map();
    
    snapshot.forEach(doc => {
        const data = doc.data();
        stockMap.set(data.nombre, {
            stock: data.stock,
            costo: parseFloat(data.costoUnitario || 0),
            precio: parseFloat(data.precioVenta || 0),
            codigo: data.codigo,
            fechaActualizacion: data.fechaActualizacion
        });
    });
    
    return stockMap;
}

function analisisAvanzadoStock(salidas, entradas, stockMap, diasAnalisis, diasCobertura, leadTime, seguridadPct, stockMinimo) {
    const productos = new Set([
        ...salidas.map(s => s.producto),
        ...entradas.map(e => e.producto),
        ...Array.from(stockMap.keys())
    ]);

    const resultados = [];
    let metricas = {
        totalProductos: 0,
        productosCriticos: 0,
        productosAlerta: 0,
        productosEstables: 0,
        inversionTotal: 0,
        riesgoTotal: 0
    };

    productos.forEach(producto => {
        const movimientosProducto = [
            ...salidas.filter(s => s.producto === producto),
            ...entradas.filter(e => e.producto === producto)
        ].sort((a, b) => a.fecha - b.fecha);

        const stockActual = stockMap.get(producto)?.stock || 0;
        const costoUnitario = stockMap.get(producto)?.costo || 0;
        
        // Análisis de tendencia
        const tendencia = calcularTendencia(movimientosProducto, diasAnalisis);
        const estacionalidad = detectarEstacionalidad(movimientosProducto);
        const velocidadConsumo = calcularVelocidadConsumo(movimientosProducto, diasAnalisis);
        
        // Cálculos mejorados
        const demandaDiaria = calcularDemandaDiaria(movimientosProducto, diasAnalisis);
        const variabilidad = calcularVariabilidadDemanda(movimientosProducto, demandaDiaria);
        const puntoPedido = calcularPuntoPedido(demandaDiaria, leadTime, variabilidad, seguridadPct);
        const coberturaDias = stockActual / Math.max(demandaDiaria, 0.1);
        
        // Clasificación de criticidad
        const criticidad = clasificarCriticidad(
            stockActual, 
            puntoPedido, 
            coberturaDias, 
            velocidadConsumo,
            stockMinimo
        );

        // Recomendación inteligente
        const recomendacion = generarRecomendacion(
            stockActual,
            demandaDiaria,
            diasCobertura,
            puntoPedido,
            criticidad,
            estacionalidad
        );

        // Actualizar métricas
        metricas.totalProductos++;
        if (criticidad.nivel === '🚨 CRÍTICO') metricas.productosCriticos++;
        if (criticidad.nivel === '⚠️ ALTO RIESGO') metricas.productosAlerta++;
        if (criticidad.nivel === '✅ ESTABLE') metricas.productosEstables++;
        
        metricas.inversionTotal += stockActual * costoUnitario;
        if (criticidad.nivel === '🚨 CRÍTICO') {
            metricas.riesgoTotal += demandaDiaria * diasCobertura * costoUnitario;
        }

        resultados.push({
            producto,
            codigo: stockMap.get(producto)?.codigo || 'N/A',
            stockActual,
            demandaDiaria: demandaDiaria.toFixed(2),
            coberturaDias: coberturaDias.toFixed(1),
            puntoPedido: Math.ceil(puntoPedido),
            tendencia: tendencia.direccion,
            velocidadConsumo,
            variabilidad: (variabilidad * 100).toFixed(1) + '%',
            criticidad: criticidad.nivel,
            recomendacion: recomendacion.texto,
            cantidadRecomendada: recomendacion.cantidad,
            prioridad: criticidad.prioridad,
            costoEstimado: (recomendacion.cantidad * costoUnitario).toFixed(2)
        });
    });

    // Ordenar por prioridad y criticidad
    resultados.sort((a, b) => b.prioridad - a.prioridad);

    // Generar alertas
    const alertas = generarAlertas(resultados);

    return { resultados, metricas, alertas };
}

// ========= ALGORITMOS DE ANÁLISIS MEJORADOS =========
function calcularTendencia(movimientos, dias) {
    if (movimientos.length < 7) return { direccion: '➡️ ESTABLE', fuerza: 0 };
    
    const ultimaSemana = movimientos.filter(m => 
        m.fecha >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const semanaAnterior = movimientos.filter(m => 
        m.fecha >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) && 
        m.fecha < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    const consumoActual = ultimaSemana.reduce((sum, m) => sum + (m.tipo === 'salida' ? m.cantidad : -m.cantidad), 0);
    const consumoAnterior = semanaAnterior.reduce((sum, m) => sum + (m.tipo === 'salida' ? m.cantidad : -m.cantidad), 0);
    
    const diferencia = consumoActual - consumoAnterior;
    const porcentaje = consumoAnterior > 0 ? (diferencia / consumoAnterior) * 100 : 0;
    
    if (Math.abs(porcentaje) > 30) {
        return { direccion: porcentaje > 0 ? '📈 ALTA' : '📉 BAJA', fuerza: Math.abs(porcentaje) };
    }
    
    return { direccion: '➡️ ESTABLE', fuerza: Math.abs(porcentaje) };
}

function detectarEstacionalidad(movimientos) {
    if (movimientos.length < 30) return 'NO_DATOS';
    
    // Agrupar por día de la semana
    const porDia = [0, 0, 0, 0, 0, 0, 0];
    movimientos.forEach(m => {
        if (m.tipo === 'salida') {
            const dia = m.fecha.getDay();
            porDia[dia] += m.cantidad;
        }
    });
    
    const max = Math.max(...porDia);
    const min = Math.min(...porDia);
    const variacion = (max - min) / (max || 1);
    
    return variacion > 0.5 ? 'ESTACIONAL' : 'CONSTANTE';
}

function calcularVelocidadConsumo(movimientos, dias) {
    const salidas = movimientos.filter(m => m.tipo === 'salida');
    const totalSalidas = salidas.reduce((sum, m) => sum + m.cantidad, 0);
    const consumoDiario = totalSalidas / dias;
    
    if (consumoDiario < 1) return 'LENTO';
    if (consumoDiario < 5) return 'MODERADO';
    return 'RÁPIDO';
}

function calcularDemandaDiaria(movimientos, dias) {
    const salidas = movimientos.filter(m => m.tipo === 'salida');
    const totalSalidas = salidas.reduce((sum, m) => sum + m.cantidad, 0);
    return totalSalidas / dias;
}

function calcularVariabilidadDemanda(movimientos, demandaPromedio) {
    if (movimientos.length < 2 || demandaPromedio === 0) return 0;
    
    const salidas = movimientos.filter(m => m.tipo === 'salida');
    const diferencias = salidas.map(m => Math.pow(m.cantidad - demandaPromedio, 2));
    const varianza = diferencias.reduce((a, b) => a + b, 0) / salidas.length;
    
    return Math.sqrt(varianza) / demandaPromedio;
}

function calcularPuntoPedido(demandaDiaria, leadTime, variabilidad, seguridad) {
    const demandaLeadTime = demandaDiaria * leadTime;
    const stockSeguridad = demandaLeadTime * variabilidad * seguridad;
    return Math.ceil(demandaLeadTime + stockSeguridad);
}

function clasificarCriticidad(stockActual, puntoPedido, coberturaDias, velocidad, stockMinimo) {
    const ratioStock = stockActual / puntoPedido;
    
    if (stockActual <= stockMinimo) {
        return { nivel: '🚨 CRÍTICO', prioridad: 100 };
    }
    if (ratioStock <= 0.5) {
        return { nivel: '⚠️ ALTO RIESGO', prioridad: 80 };
    }
    if (coberturaDias < 15 && velocidad === 'RÁPIDO') {
        return { nivel: '🔶 ALERTA', prioridad: 60 };
    }
    if (coberturaDias < 30) {
        return { nivel: '📋 VIGILAR', prioridad: 40 };
    }
    return { nivel: '✅ ESTABLE', prioridad: 20 };
}

function generarRecomendacion(stockActual, demandaDiaria, diasCobertura, puntoPedido, criticidad, estacionalidad) {
    const stockDeseado = demandaDiaria * diasCobertura;
    let cantidadBase = Math.max(0, stockDeseado - stockActual);
    
    // Ajustar por criticidad y estacionalidad
    if (criticidad.nivel === '🚨 CRÍTICO') {
        cantidadBase *= 1.5; // Urgente - comprar más
    }
    if (estacionalidad === 'ESTACIONAL') {
        cantidadBase *= 1.2; // Prepararse para picos
    }
    
    // Redondear y asegurar mínimo
    const cantidad = Math.ceil(Math.max(cantidadBase, puntoPedido * 0.3));
    
    let texto = '';
    if (cantidad === 0) {
        texto = 'Stock suficiente';
    } else if (criticidad.nivel === '🚨 CRÍTICO') {
        texto = '🚨 COMPRA URGENTE';
    } else if (cantidad > demandaDiaria * 30) {
        texto = '📦 COMPRA PROGRAMADA';
    } else {
        texto = '🛒 REPONER STOCK';
    }
    
    return { texto, cantidad };
}

// ========= VISUALIZACIÓN MEJORADA =========
function mostrarResultadosIA(analisis) {
    const tbody = document.querySelector('#tabla-ia-resultados tbody');
    tbody.innerHTML = '';

    analisis.resultados.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = `fila-criticidad-${item.criticidad.toLowerCase().replace(/[^a-z]/g, '')}`;
        
        tr.innerHTML = `
            <td>
                <strong>${item.producto}</strong>
                <br><small class="text-muted">${item.codigo}</small>
            </td>
            <td>${item.stockActual}</td>
            <td>${item.demandaDiaria}</td>
            <td>${item.coberturaDias} días</td>
            <td>${item.puntoPedido}</td>
            <td>
                <span class="tendencia ${item.tendencia.includes('ALTA') ? 'tendencia-alta' : item.tendencia.includes('BAJA') ? 'tendencia-baja' : 'tendencia-estable'}">
                    ${item.tendencia}
                </span>
            </td>
            <td>
                <span class="badge criticidad-${item.criticidad.toLowerCase().replace(/[^a-z]/g, '')}">
                    ${item.criticidad}
                </span>
            </td>
            <td><strong>${item.cantidadRecomendada > 0 ? item.cantidadRecomendada : '-'}</strong></td>
            <td>${item.recomendacion}</td>
            <td>S/ ${item.costoEstimado}</td>
        `;
        tbody.appendChild(tr);
    });
}

function mostrarMetricasIA(metricas) {
    const contenedor = document.getElementById('metricas-ia');
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div class="metricas-grid">
            <div class="metrica-card">
                <div class="metrica-valor">${metricas.totalProductos}</div>
                <div class="metrica-label">Total Productos</div>
            </div>
            <div class="metrica-card critica">
                <div class="metrica-valor">${metricas.productosCriticos}</div>
                <div class="metrica-label">Críticos</div>
            </div>
            <div class="metrica-card alerta">
                <div class="metrica-valor">${metricas.productosAlerta}</div>
                <div class="metrica-label">En Alerta</div>
            </div>
            <div class="metrica-card estable">
                <div class="metrica-valor">${metricas.productosEstables}</div>
                <div class="metrica-label">Estables</div>
            </div>
            <div class="metrica-card">
                <div class="metrica-valor">S/ ${metricas.inversionTotal.toFixed(2)}</div>
                <div class="metrica-label">Inversión Stock</div>
            </div>
            <div class="metrica-card riesgo">
                <div class="metrica-valor">S/ ${metricas.riesgoTotal.toFixed(2)}</div>
                <div class="metrica-label">Riesgo Potencial</div>
            </div>
        </div>
    `;
}

function generarAlertasIA(alertas) {
    const contenedor = document.getElementById('alertas-ia');
    if (!contenedor || !alertas.length) return;

    contenedor.innerHTML = `
        <div class="alertas-container">
            <h4>🚨 Alertas Prioritarias</h4>
            ${alertas.map(alerta => `
                <div class="alerta-item ${alerta.tipo}">
                    <i class="fas ${alerta.icono}"></i>
                    <span>${alerta.mensaje}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function generarAlertas(resultados) {
    const alertas = [];
    
    const criticos = resultados.filter(r => r.criticidad === '🚨 CRÍTICO');
    if (criticos.length > 0) {
        alertas.push({
            tipo: 'critica',
            icono: 'fa-exclamation-triangle',
            mensaje: `${criticos.length} productos en estado CRÍTICO requieren atención inmediata`
        });
    }
    
    const sinMovimiento = resultados.filter(r => r.demandaDiaria === '0.00' && r.stockActual > 0);
    if (sinMovimiento.length > 5) {
        alertas.push({
            tipo: 'advertencia',
            icono: 'fa-chart-line',
            mensaje: `${sinMovimiento.length} productos sin movimiento - considerar rotación`
        });
    }
    
    const altaVariabilidad = resultados.filter(r => parseFloat(r.variabilidad) > 50);
    if (altaVariabilidad.length > 0) {
        alertas.push({
            tipo: 'info',
            icono: 'fa-random',
            mensaje: `${altaVariabilidad.length} productos con demanda variable - revisar patrones`
        });
    }
    
    return alertas;
}

// ========= FUNCIÓN PARA MOSTRAR APARTADO IA =========
function mostrarApartadoIA() {
    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    document.getElementById('apartado-ia').style.display = 'block';
    
    // Actualizar navegación
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector('.nav-link[onclick*="ia"]').classList.add('active');
    
    // Precargar librería PDF
    cargarLibreriaPDF().catch(() => {
        console.warn('No se pudo cargar la librería PDF');
    });
    
    // Inicializar IA
    setTimeout(() => {
        inicializarIA();
        calcularIAStockMejorado();
    }, 500);
}

// ========= EXPORTAR REPORTE IA A PDF =========
a// ========= EXPORTAR REPORTE IA A PDF - VERSIÓN CORREGIDA =========
async function exportarIAPDF() {
    try {
        // Verificar que jsPDF esté disponible
        if (typeof window.jspdf === 'undefined') {
            alert("⚠️ Cargando librería PDF... Por favor espere.");
            await cargarLibreriaPDF();
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Configuración inicial
        const margin = 15;
        let yPosition = margin;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // ===== ENCABEZADO =====
        doc.setFillColor(21, 85, 232);
        doc.rect(0, 0, pageWidth, 25, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE IA - PREDICCION DE STOCK', pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, 22, { align: 'center' });
        
        yPosition = 35;
        
        // ===== MÉTRICAS PRINCIPALES =====
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F');
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('METRICAS DEL SISTEMA', margin + 5, yPosition + 10);
        
        // Obtener métricas actuales
        const metricasContainer = document.getElementById('metricas-ia');
        if (metricasContainer) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            
            const totalProductos = metricasContainer.querySelector('.metrica-card:nth-child(1) .metrica-valor')?.textContent || '0';
            const productosCriticos = metricasContainer.querySelector('.metrica-card:nth-child(2) .metrica-valor')?.textContent || '0';
            const productosAlerta = metricasContainer.querySelector('.metrica-card:nth-child(3) .metrica-valor')?.textContent || '0';
            const productosEstables = metricasContainer.querySelector('.metrica-card:nth-child(4) .metrica-valor')?.textContent || '0';
            const inversionStock = metricasContainer.querySelector('.metrica-card:nth-child(5) .metrica-valor')?.textContent || 'S/ 0.00';
            const riesgoPotencial = metricasContainer.querySelector('.metrica-card:nth-child(6) .metrica-valor')?.textContent || 'S/ 0.00';
            
            const metricas = [
                `Total Productos Analizados: ${totalProductos}`,
                `Productos Criticos: ${productosCriticos}`,
                `Productos en Alerta: ${productosAlerta}`,
                `Productos Estables: ${productosEstables}`,
                `Inversion en Stock: ${inversionStock}`,
                `Riesgo Potencial: ${riesgoPotencial}`
            ];
            
            metricas.forEach((metrica, index) => {
                const x = margin + 5 + (index % 2) * 90;
                const y = yPosition + 20 + Math.floor(index / 2) * 8;
                doc.text(metrica, x, y);
            });
        }
        
        yPosition += 50;
        
        // ===== ALERTAS =====
        const alertasContainer = document.getElementById('alertas-ia');
        if (alertasContainer && alertasContainer.innerHTML.trim() !== '') {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(231, 76, 60);
            doc.text('ALERTAS PRIORITARIAS', margin, yPosition);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            
            const alertas = alertasContainer.querySelectorAll('.alerta-item');
            let alertaY = yPosition + 10;
            
            alertas.forEach((alerta) => {
                if (alertaY > pageHeight - 30) {
                    doc.addPage();
                    alertaY = margin + 10;
                }
                
                const texto = alerta.querySelector('span')?.textContent || '';
                // Limpiar texto de caracteres especiales
                const textoLimpio = texto.replace(/[^\x20-\x7E]/g, '');
                
                doc.text(`• ${textoLimpio}`, margin + 5, alertaY);
                alertaY += 6;
            });
            
            yPosition = alertaY + 10;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('No hay alertas criticas', margin, yPosition);
            yPosition += 15;
        }
        
        // ===== RECOMENDACIONES DETALLADAS =====
        if (yPosition > pageHeight - 50) {
            doc.addPage();
            yPosition = margin;
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(21, 85, 232);
        doc.text('RECOMENDACIONES DE COMPRA INTELIGENTES', margin, yPosition);
        yPosition += 10;
        
        // Obtener datos de la tabla
        const tabla = document.getElementById('tabla-ia-resultados');
        const filas = tabla?.querySelectorAll('tbody tr') || [];
        
        if (filas.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('No hay datos para mostrar. Ejecute el analisis IA primero.', margin, yPosition);
        } else {
            // Configurar columnas más ajustadas
            const columnas = [
                { header: 'Producto', width: 45 },
                { header: 'Stock', width: 12 },
                { header: 'Dem/Dia', width: 15 },
                { header: 'Cobert', width: 15 },
                { header: 'P.Pedido', width: 15 },
                { header: 'Estado', width: 18 },
                { header: 'Cant.', width: 12 },
                { header: 'Accion', width: 25 }
            ];
            
            // Encabezados de tabla
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(44, 90, 160);
            
            let xPosition = margin;
            columnas.forEach(col => {
                doc.rect(xPosition, yPosition, col.width, 6, 'F');
                // Centrar texto en encabezados
                const textWidth = doc.getTextWidth(col.header);
                doc.text(col.header, xPosition + (col.width - textWidth) / 2, yPosition + 4);
                xPosition += col.width;
            });
            
            yPosition += 6;
            
            // Datos de la tabla
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            
            filas.forEach((fila) => {
                if (yPosition > pageHeight - 15) {
                    doc.addPage();
                    yPosition = margin;
                    
                    // Repetir encabezados en nueva página
                    doc.setFillColor(44, 90, 160);
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    let x = margin;
                    columnas.forEach(col => {
                        doc.rect(x, yPosition, col.width, 6, 'F');
                        const textWidth = doc.getTextWidth(col.header);
                        doc.text(col.header, x + (col.width - textWidth) / 2, yPosition + 4);
                        x += col.width;
                    });
                    yPosition += 6;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                    doc.setTextColor(0, 0, 0);
                }
                
                const celdas = fila.querySelectorAll('td');
                if (celdas.length >= 8) {
                    xPosition = margin;
                    
                    // Producto (recortar si es muy largo)
                    let producto = celdas[0].querySelector('strong')?.textContent || celdas[0].textContent || '';
                    producto = producto.replace(/[^\x20-\x7E]/g, ''); // Limpiar caracteres especiales
                    if (producto.length > 25) producto = producto.substring(0, 22) + '...';
                    doc.text(producto, xPosition + 2, yPosition + 4);
                    xPosition += columnas[0].width;
                    
                    // Stock Actual
                    const stock = celdas[1].textContent || '0';
                    doc.text(stock, xPosition + 2, yPosition + 4);
                    xPosition += columnas[1].width;
                    
                    // Demanda Diaria
                    const demanda = celdas[2].textContent || '0';
                    doc.text(demanda, xPosition + 2, yPosition + 4);
                    xPosition += columnas[2].width;
                    
                    // Cobertura Días
                    const cobertura = celdas[3].textContent || '0';
                    doc.text(cobertura, xPosition + 2, yPosition + 4);
                    xPosition += columnas[3].width;
                    
                    // Punto Pedido
                    const puntoPedido = celdas[4].textContent || '0';
                    doc.text(puntoPedido, xPosition + 2, yPosition + 4);
                    xPosition += columnas[4].width;
                    
                    // Criticidad (limpiar emojis)
                    let criticidad = celdas[6].textContent || '';
                    criticidad = criticidad.replace(/[^\x20-\x7E]/g, '') // Remover emojis
                                          .replace('CRITICO', 'CRIT')
                                          .replace('ALTO RIESGO', 'ALTO')
                                          .replace('ALERTA', 'ALERT')
                                          .replace('VIGILAR', 'VIGIL')
                                          .replace('ESTABLE', 'EST');
                    if (criticidad.length > 8) criticidad = criticidad.substring(0, 7);
                    doc.text(criticidad, xPosition + 2, yPosition + 4);
                    xPosition += columnas[5].width;
                    
                    // Cantidad Recomendada
                    const cantidad = celdas[7].textContent || '-';
                    doc.text(cantidad, xPosition + 2, yPosition + 4);
                    xPosition += columnas[6].width;
                    
                    // Acción Recomendada
                    let accion = celdas[8].textContent || '';
                    accion = accion.replace(/[^\x20-\x7E]/g, '') // Remover emojis
                                  .replace('COMPRA URGENTE', 'URGENTE')
                                  .replace('COMPRA PROGRAMADA', 'PROGRAMADA')
                                  .replace('REPONER STOCK', 'REPONER')
                                  .replace('Stock suficiente', 'OK');
                    if (accion.length > 15) accion = accion.substring(0, 12) + '...';
                    doc.text(accion, xPosition + 2, yPosition + 4);
                    
                    // Línea separadora
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5);
                    
                    yPosition += 6;
                }
            });
        }
        
        // ===== PIE DE PÁGINA =====
        const totalPaginas = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPaginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Pagina ${i} de ${totalPaginas}`, pageWidth - margin - 5, pageHeight - 10, { align: 'right' });
            doc.text('Sistema de Inventario - IA Predictiva', margin + 5, pageHeight - 10);
        }
        
        // ===== GUARDAR PDF =====
        const fecha = new Date().toISOString().split('T')[0];
        doc.save(`Reporte_IA_Prediccion_${fecha}.pdf`);
        
        alert('✅ PDF generado exitosamente!');
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('❌ Error al generar el PDF: ' + error.message);
    }
}

// ===== CARGAR LIBRERÍA PDF DINÁMICAMENTE =====
function cargarLibreriaPDF() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
            setTimeout(resolve, 500); // Pequeño delay para asegurar carga
        };
        script.onerror = () => reject(new Error('Error al cargar librería PDF'));
        document.head.appendChild(script);
    });
}

// ===== CARGAR LIBRERÍA PDF DINÁMICAMENTE =====
function cargarLibreriaPDF() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Error al cargar librería PDF'));
        document.head.appendChild(script);
    });
}

// ========= INICIALIZACIÓN MEJORADA =========
function mostrarApartadoIA() {
    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    document.getElementById('apartado-ia').style.display = 'block';
    
    // Actualizar navegación
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector('.nav-link[onclick*="ia"]').classList.add('active');
    
    // Inicializar IA
    setTimeout(() => {
        inicializarIA();
        calcularIAStockMejorado();
    }, 500);
}

// Lee salidas desde la tabla #tabla-salida (fecha, producto, cantidad)
function recolectarSalidas(diasAnalisis) {
  const tbody = document.querySelector('#tabla-salida tbody');
  if (!tbody) return [];

  const desde = new Date();
  desde.setDate(desde.getDate() - Number(diasAnalisis));

  const salidas = [];
  [...tbody.rows].forEach(tr => {
    // Ajusta estos índices a tu tabla real
    // Ejemplo: [0]=fecha, [1]=código, [2]=producto, [3]=cantidad
    const celdas = tr.querySelectorAll('td');
    if (celdas.length < 4) return;

    const fechaTxt = (celdas[0].innerText || '').trim();
    const producto = (celdas[2].innerText || '').trim();
    const cantidad = Number((celdas[3].innerText || '0').replace(/[^0-9.-]/g, ''));

    const fecha = new Date(fechaTxt);
    if (!isNaN(fecha) && fecha >= desde && cantidad > 0 && producto) {
      salidas.push({ fecha, producto, cantidad });
    }
  });
  return salidas;
}

// Lee stock actual por producto desde #tabla-inventario
function recolectarStockActual() {
  const tbody = document.querySelector('#tabla-inventario tbody');
  const stockMap = new Map();
  if (!tbody) return stockMap;

  [...tbody.rows].forEach(tr => {
    // Ajusta índices según tus columnas reales
    // Ejemplo: [0]=Código, [1]=Producto, [2]=Categoría, [3]=Stock
    const tds = tr.querySelectorAll('td');
    if (tds.length < 4) return;

    const producto = (tds[1].innerText || '').trim();
    const stock = Number((tds[3].innerText || '0').replace(/[^0-9.-]/g, ''));
    if (producto) stockMap.set(producto, (stockMap.get(producto) || 0) + (isNaN(stock) ? 0 : stock));
  });

  return stockMap;
}

// Calcula promedio diario por producto a partir de salidas
function promedioDiarioPorProducto(salidas, diasAnalisis) {
  const sumas = new Map();
  salidas.forEach(s => {
    sumas.set(s.producto, (sumas.get(s.producto) || 0) + s.cantidad);
  });

  const promedios = new Map();
  const dias = Math.max(1, Number(diasAnalisis));
  sumas.forEach((total, prod) => {
    promedios.set(prod, total / dias);
  });
  return promedios;
}

// Dibuja resultados en tabla
function renderIAResultados(rows) {
  const tbody = document.querySelector('#tabla-ia-resultados tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows
    .sort((a,b) => b.recomendada - a.recomendada) // ordenar por mayor recomendación
    .forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.producto}</td>
        <td>${r.promedioDiario.toFixed(2)}</td>
        <td>${r.stockActual}</td>
        <td>${r.puntoPedido}</td>
        <td><strong>${r.recomendada > 0 ? Math.ceil(r.recomendada) : 0}</strong></td>
        <td>${r.observacion}</td>
      `;
      tbody.appendChild(tr);
    });
}



// Función principal
function calcularIAStock() {
  const diasAnalisis  = Number(document.getElementById('ia-dias-analisis').value || 30);
  const diasCobertura = Number(document.getElementById('ia-dias-cobertura').value || 30);
  const leadTime      = Number(document.getElementById('ia-leadtime').value || 5);
  const seguridadPct  = Number(document.getElementById('ia-seguridad').value || 20) / 100;

  const salidas = recolectarSalidas(diasAnalisis);
  const stockMap = recolectarStockActual();
  const promMap = promedioDiarioPorProducto(salidas, diasAnalisis);

  const resultados = [];

  // Unir por producto presente en salidas o inventario
  const productos = new Set([...promMap.keys(), ...stockMap.keys()]);
  productos.forEach(prod => {
    const promedio = promMap.get(prod) || 0;
    const stockActual = stockMap.get(prod) || 0;

    // Punto de pedido = demanda diaria * lead time + seguridad
    const puntoPedido = Math.ceil(promedio * leadTime * (1 + seguridadPct));

    // Cobertura objetivo = demanda diaria * días cobertura
    const objetivo = promedio * diasCobertura;

    // Recomendación: comprar lo necesario para alcanzar la cobertura objetivo
    let recomendada = Math.max(0, objetivo - stockActual);
    let observacion = 'OK';
    if (stockActual <= puntoPedido) {
      observacion = '🚨 Por debajo del punto de pedido';
    } else if (recomendada > 0) {
      observacion = '⚠️ Reponer para cobertura';
    }

    resultados.push({
      producto: prod,
      promedioDiario: promedio,
      stockActual,
      puntoPedido,
      recomendada,
      observacion
    });
  });

  // Filtra solo productos con recomendación > 0 o alerta
  const filtrados = resultados.filter(r => r.recomendada > 0 || r.stockActual <= r.puntoPedido);
  renderIAResultados(filtrados);
}

function cambiarSeccion(idSeccion, elLink) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  const destino = document.getElementById(idSeccion);
  if (destino) destino.style.display = 'block';

  // activar link
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  if (elLink) elLink.classList.add('active');
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

// =========================================================
// 📊 Exportar a Excel (.xlsx) con 4 hojas — VERSIÓN CON FORMATO BÁSICO
// =========================================================
async function exportarExcelInventario() {
  try {
    if (typeof XLSX === 'undefined') {
      alert('⚠️ Falta la librería XLSX. Agrega <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script> antes de script.js');
      return;
    }

    // ===== 1) GUARDAR ESTADO ACTUAL =====
    const adminPanel = document.getElementById('dashboard-admin');
    const mechanicPanel = document.getElementById('dashboard-mecanico');
    
    // Guardar estados actuales
    const adminWasVisible = adminPanel.style.display === 'block';
    const mechanicWasVisible = mechanicPanel.style.display === 'block';
    
    // ===== 2) MOSTRAR SOLO EL PANEL DE ADMINISTRADOR =====
    if (adminPanel) adminPanel.style.display = 'block';
    if (mechanicPanel) mechanicPanel.style.display = 'none';

    // ===== 3) OBTENER DATOS DIRECTAMENTE DE FIRESTORE =====
    if (!db) {
      alert("❌ Error: Base de datos no disponible");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Función para crear una hoja con formato básico
    const crearHojaConFormato = (datos, nombreHoja) => {
      if (datos.length === 0) return null;

      // Crear la hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(datos);
      
      // Ajustar anchos de columnas automáticamente
      const range = XLSX.utils.decode_range(ws['!ref']);
      const colWidths = [];
      
      for (let C = range.s.c; C <= range.e.c; C++) {
        let maxLength = 10; // Ancho mínimo
        for (let R = range.s.r; R <= range.e.r; R++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws[cellAddress] && ws[cellAddress].v) {
            const cellLength = ws[cellAddress].v.toString().length;
            if (cellLength > maxLength) maxLength = cellLength;
          }
        }
        // Limitar el ancho máximo
        colWidths.push({ wch: Math.min(maxLength + 2, 30) });
      }
      
      ws['!cols'] = colWidths;
      
      // Agregar auto-filtro a los encabezados
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
      
      return ws;
    };

    try {
      // HOJA 1: INVENTARIO (STOCK)
      const inventarioSnapshot = await db.collection('inventario').orderBy('nombre').get();
      const datosInventario = inventarioSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          'FECHA ACTUALIZACIÓN': data.fechaActualizacion || 'N/A',
          'CÓDIGO': data.codigo || '',
          'NOMBRE DEL PRODUCTO': data.nombre || '',
          'LOTE': data.lote || '',
          'COSTO UNITARIO (S/.)': `S/ ${parseFloat(data.costoUnitario || 0).toFixed(2)}`,
          'PRECIO VENTA (S/.)': `S/ ${parseFloat(data.precioVenta || 0).toFixed(2)}`,
          'STOCK ACTUAL': data.stock || 0
        };
      });
      
      if (datosInventario.length > 0) {
        const wsInventario = crearHojaConFormato(datosInventario, 'Inventario (Stock)');
        XLSX.utils.book_append_sheet(wb, wsInventario, '📦 INVENTARIO');
      }

      // HOJA 2: HISTORIAL DE ENTRADAS
      const entradasSnapshot = await db.collection('historialEntradas').orderBy('fecha', 'desc').get();
      const datosEntradas = entradasSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          'FECHA DE ENTRADA': data.fecha || 'N/A',
          'CÓDIGO PRODUCTO': data.codigo || '',
          'NOMBRE DEL PRODUCTO': data.nombre || '',
          'CANTIDAD INGRESADA': data.cantidad || 0
        };
      });
      
      if (datosEntradas.length > 0) {
        const wsEntradas = crearHojaConFormato(datosEntradas, 'Historial de Entradas');
        XLSX.utils.book_append_sheet(wb, wsEntradas, '⬇️ ENTRADAS');
      }

      // HOJA 3: HISTORIAL DE SALIDAS
      const salidasSnapshot = await db.collection('repuestosSalida').orderBy('fecha', 'desc').get();
      const datosSalidas = salidasSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          'FECHA DE SALIDA': data.fecha || 'N/A',
          'REPUESTO UTILIZADO': data.repuesto || '',
          'CLIENTE': data.cliente || '',
          'N° ORDEN TRABAJO': data.numeroOT || '',
          'CANTIDAD RETIRADA': data.cantidad || 0,
          'PLACA VEHÍCULO': data.placa || 'N/A',
          'KILOMETRAJE': data.kilometraje || 0
        };
      });
      
      if (datosSalidas.length > 0) {
        const wsSalidas = crearHojaConFormato(datosSalidas, 'Historial de Salidas');
        XLSX.utils.book_append_sheet(wb, wsSalidas, '⬆️ SALIDAS');
      }

      // HOJA 4: HISTORIAL DE SOLICITUDES
      const solicitudesSnapshot = await db.collection('solicitudesRepuestos').orderBy('fecha', 'desc').get();
      const datosSolicitudes = solicitudesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          'FECHA SOLICITUD': data.fecha || 'N/A',
          'MECÁNICO SOLICITANTE': data.mecanico || '',
          'REPUESTO SOLICITADO': data.repuesto || '',
          'CANTIDAD SOLICITADA': data.cantidad || 0,
          'ESTADO ACTUAL': data.estado || ''
        };
      });
      
      if (datosSolicitudes.length > 0) {
        const wsSolicitudes = crearHojaConFormato(datosSolicitudes, 'Historial de Solicitudes');
        XLSX.utils.book_append_sheet(wb, wsSolicitudes, '📋 SOLICITUDES');
      }

      // ===== 4) VERIFICAR QUE HAY DATOS =====
      if (wb.SheetNames.length === 0) {
        alert('⚠️ No hay datos para exportar.');
        return;
      }

      // ===== 5) GENERAR Y DESCARGAR EXCEL =====
      const fecha = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `INVENTARIO_COMPLETO_${fecha}.xlsx`);
      
      alert(`✅ EXCEL GENERADO EXITOSAMENTE!\n\n📊 CONTIENE ${wb.SheetNames.length} HOJAS:\n• 📦 INVENTARIO (Stock actual)\n• ⬇️ ENTRADAS (Historial)\n• ⬆️ SALIDAS (Historial)  \n• 📋 SOLICITUDES (Historial)\n\n✨ Los encabezados tienen auto-filtro para fácil organización`);

    } catch (error) {
      console.error("Error al obtener datos de Firestore:", error);
      alert("❌ Error al obtener los datos para el Excel.");
    }

  } catch (err) {
    console.error('Error al exportar Excel:', err);
    alert('❌ Error al generar el Excel. Revisa la consola (F12).');
  } finally {
    // ===== 6) RESTAURAR ESTADO ORIGINAL =====
    if (typeof mostrarApartado === 'function') {
      try {
        const navLinkActivo = document.querySelector('.nav-link.active');
        if (navLinkActivo) {
          const onclickAttr = navLinkActivo.getAttribute('onclick');
          if (onclickAttr && onclickAttr.includes("mostrarApartado")) {
            const match = onclickAttr.match(/mostrarApartado\('([^']*)'\)/);
            if (match && match[1] !== undefined) {
              mostrarApartado(match[1]);
            }
          }
        }
      } catch (e) {
        console.warn("No se pudo restaurar la sección activa:", e);
        mostrarApartado('');
      }
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
        
    } catch (error) {
        console.error("Error al registrar la solicitud:", error);
        alert("Hubo un error al enviar la solicitud.");
    }
}

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

async function exportarPDF() {
    alert("Generando reporte... Esto puede tardar unos segundos.");
    
    if (!db) {
        alert("El sistema no está listo para exportar. Intente nuevamente.");
        console.error("Firestore no está inicializado (exportarPDF)");
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
async function exportarGraficosPDF() {
    alert("Generando PDF...");

    try {
        // Verifica que jsPDF esté disponible
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("⚠️ Falta la librería jsPDF. Agrega el <script> antes de script.js en tu HTML.");
            return;
        }

        // Inicializa jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4'); // A4 vertical

        // ====== ENCABEZADO ======
        const fecha = new Date().toLocaleDateString('es-ES');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(67, 97, 238); // Azul título
        doc.setFontSize(16);
        doc.text('Reporte de Gráficos - Sistema de Inventario', 105, 15, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(85, 85, 85);
        doc.text(`Generado: ${fecha}`, 105, 22, { align: 'center' });

        // ====== GRÁFICOS (en cuadrícula 2x2) ======
        const charts = [
            { id: 'chartMovimientosDia',       titulo: 'Movimientos por Día' },
            { id: 'chartProductosMovimientos', titulo: 'Productos con Más Movimientos' },
            { id: 'chartDistribucionStock',    titulo: 'Distribución de Stock' },
            { id: 'chartTendenciaMensual',     titulo: 'Tendencia Mensual' }
        ];

        // Medidas del layout
        const marginX = 12;
        const marginTop = 30;
        const gap = 6;
        const cellW = 90;
        const cellH = 85;

        // Posiciones exactas en mm (para que quepan perfectamente en A4)
        const positions = [
            { x: marginX, y: marginTop },                          // Arriba izquierda
            { x: marginX + cellW + gap, y: marginTop },            // Arriba derecha
            { x: marginX, y: marginTop + cellH + gap },            // Abajo izquierda
            { x: marginX + cellW + gap, y: marginTop + cellH + gap } // Abajo derecha
        ];

        // ====== DIBUJAR CADA GRÁFICO ======
        for (let i = 0; i < charts.length; i++) {
            const { id, titulo } = charts[i];
            const { x, y } = positions[i];
            const canvas = document.getElementById(id);
            if (!canvas) continue;

            // Título encima del gráfico
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(21, 85, 232);
            doc.text(titulo, x + cellW / 2, y - 3, { align: 'center' });

            // Imagen del canvas
            const imgData = canvas.toDataURL('image/png', 1.0);
            doc.addImage(imgData, 'PNG', x, y, cellW, cellH);
        }

        // ====== PIE DE PÁGINA ======
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text('Sistema de Inventario – Generado automáticamente', 105, 290, { align: 'center' });

        // ====== GUARDAR ======
        doc.save('reporte_graficos.pdf');
        alert("✅ PDF generado correctamente en una sola hoja.");

    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("❌ Error al generar el PDF. Revisa la consola (F12).");
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
    
    // Configurar event listeners
    document.querySelector('#login .btn-primary').addEventListener('click', login);
    document.getElementById('entrada-codigo').addEventListener('input', autocompletarNombreEntrada);
    document.getElementById('salida-codigo').addEventListener('input', autocompletarNombreSalida);
    document.getElementById('nuevo-codigo').addEventListener('input', autocompletarNombreAgregarProducto);
    document.getElementById('solicitar-codigo').addEventListener('input', autocompletarNombreSolicitud);
    document.getElementById('form-entrada').addEventListener('submit', agregarEntrada);
    document.getElementById('form-salida').addEventListener('submit', agregarSalida);
    document.getElementById('form-agregar-producto').addEventListener('submit', agregarNuevoProducto);
    document.getElementById('form-solicitar-repuesto').addEventListener('submit', solicitarRepuesto);
});