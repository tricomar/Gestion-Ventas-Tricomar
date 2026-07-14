# Registro de Ventas - Documentación

## 📅 Vista de Calendario Histórico

El módulo **Registro de Ventas** permite consultar y visualizar las ventas históricas en formato calendario, facilitando el análisis de patrones y tendencias de ventas.

---

## 🎯 Características Principales

### 1. Vista de Calendario Mensual
- Visualización de todos los días del mes con sus totales de ventas
- Los días con ventas muestran el monto total vendido ese día
- El día actual se marca con un indicador visual
- Navegación entre meses y años con flechas

### 2. Panel de Resumen
Muestra tres métricas clave:
- **Total del Mes**: Suma de todas las ventas del mes actual
- **Total del Año**: Suma de todas las ventas del año completo
- **Ventas del Mes**: Número total de registros de ventas

### 3. Detalle de Ventas por Día
Al hacer click en cualquier día del calendario:
- Se muestran todas las ventas realizadas ese día
- Cada venta incluye:
  - Nombre del producto
  - Cantidad vendida
  - Método de pago
  - Cliente (si aplica)
  - Monto total

---

## 🔐 Permisos de Edición

### Roles con Permisos de Edición:
- ✅ **Administrador** (admin)
- ✅ **Supervisor** (supervisor)

### Roles de Solo Lectura:
- 📖 **Sub-Admin** (sub_admin)
- 📖 **Empleado** (empleado)

Los usuarios sin permisos de edición verán un badge "📖 Solo lectura" en la esquina superior derecha.

---

## 🚀 Acceso a la Funcionalidad

### Desde el Dashboard:
1. Hacer click en el botón **"REGISTRO DE VENTAS"** ubicado en la esquina superior derecha, junto al "Total Hoy"
2. La vista se abrirá mostrando el mes y año actual

### Navegación:
- **← (Flecha izquierda)**: Ir al mes anterior
- **→ (Flecha derecha)**: Ir al mes siguiente
- **← (Flecha arriba-izquierda)**: Volver al Dashboard

---

## 📊 Casos de Uso

### 1. Análisis de Tendencias
Identificar patrones de ventas:
- ¿Qué días de la semana venden más?
- ¿Hay patrones mensuales?
- ¿Cómo se comparan los meses del año?

### 2. Planificación Futura
Usar datos históricos para:
- Predecir ventas futuras
- Planificar inventario
- Ajustar estrategias de marketing

### 3. Auditoría y Control
- Verificar ventas de días específicos
- Revisar detalles de transacciones pasadas
- Validar totales mensuales y anuales

---

## 🔧 API Endpoints Disponibles

### 1. Obtener Calendario Mensual
```
GET /api/sales-records/calendar/{year}/{month}
```
Retorna: totales por día, total del mes y del año

### 2. Obtener Ventas de un Día
```
GET /api/sales-records/day/{date}
```
Formato fecha: YYYY-MM-DD
Retorna: todas las ventas del día con detalles

### 3. Resumen del Mes
```
GET /api/sales-records/month-summary/{year}/{month}
```
Retorna: resumen detallado con utilidades y productos más vendidos

### 4. Resumen del Año
```
GET /api/sales-records/year-summary/{year}
```
Retorna: totales mensuales y total anual

---

## 💡 Próximas Mejoras Sugeridas

1. **Exportación de Datos**
   - Exportar ventas del mes a Excel/PDF
   - Generar reportes automáticos

2. **Comparaciones**
   - Comparar mes actual vs mes anterior
   - Comparar año actual vs año anterior

3. **Filtros Avanzados**
   - Filtrar por tienda (A o B)
   - Filtrar por producto
   - Filtrar por método de pago

4. **Visualizaciones**
   - Gráficos de líneas para tendencias
   - Gráficos de barras para comparaciones
   - Métricas de crecimiento

---

## 🎨 Diseño y UX

- **Estilo**: Neo-brutalista consistente con el resto de la aplicación
- **Colores distintivos**:
  - Verde (#D4F0A5) para Total del Mes
  - Naranja (#FADBB0) para Total del Año
  - Gris (#F4F4F0) para información adicional
- **Interactividad**: Los días con ventas son clickeables y muestran feedback visual
- **Responsivo**: Se adapta a diferentes tamaños de pantalla

---

## 📝 Notas Técnicas

- Los datos se almacenan en la colección `sales` de MongoDB
- Las fechas se guardan en formato ISO 8601
- Los totales se calculan en tiempo real desde la base de datos
- No hay caché, siempre se obtienen datos frescos
- La navegación entre meses no afecta el rendimiento

---

## ⚡ Uso de Datos para Analítica Futura

Esta funcionalidad es la **base** para el módulo futuro de:
- **Predicción de Ventas**: Machine Learning sobre datos históricos
- **Análisis de Comportamiento**: Identificar patrones de compra
- **Recomendaciones**: Sugerir productos según temporada
- **Alertas Inteligentes**: Notificar caídas o picos de ventas
