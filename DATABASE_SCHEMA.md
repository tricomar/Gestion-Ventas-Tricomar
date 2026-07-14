# Esquema de Base de Datos - Actualizado

## 📊 Colecciones y Esquema Completo

Esta es la definición actualizada del esquema de base de datos que valida y corrige la función **"Validar y Corregir Esquema"**.

---

## 🔄 Últimas Actualizaciones Aplicadas

### 1. Colección `sales` 
**Campos agregados:**
- ✅ `date` - Fecha de la venta (puede diferir de `created_at` para ventas pasadas)
- ✅ `price` - Precio unitario del producto
- ✅ `user_id` - ID del usuario que registró la venta
- ✅ `user_name` - Nombre del usuario que registró la venta

**Índices agregados:**
- ✅ `user_id` (no único) - Para filtrar ventas por usuario
- ✅ `date` (no único) - Para consultas de calendario y reportes

### 2. Colección `products`
**Campos agregados:**
- ✅ `stock` - Cantidad en inventario

**Índices agregados:**
- ✅ `barcode` (no único) - Para búsqueda por código de barras

### 3. Colección `customers`
**Campos agregados:**
- ✅ `purchase_count` - Contador de compras realizadas

**Índices agregados:**
- ✅ `email` (no único) - Para búsqueda y validación de clientes

---

## 📋 Esquema Completo Actual

### 1. `users`
```json
{
  "indexes": [
    {"key": "email", "unique": true},
    {"key": "id", "unique": true}
  ],
  "required_fields": [
    "id", "email", "password_hash", "name", "role", "created_at"
  ]
}
```

### 2. `products`
```json
{
  "indexes": [
    {"key": "id", "unique": true},
    {"key": "name", "unique": false},
    {"key": "store", "unique": false},
    {"key": "barcode", "unique": false}  // ← NUEVO
  ],
  "required_fields": [
    "id", "name", "cost_price", "sale_price", "store", "stock", "created_at"
  ]
}
```
**Nota**: `stock` ahora es requerido

### 3. `sales`
```json
{
  "indexes": [
    {"key": "id", "unique": true},
    {"key": "product_id", "unique": false},
    {"key": "customer_id", "unique": false},
    {"key": "date", "unique": false},  // ← IMPORTANTE para calendario
    {"key": "store", "unique": false},
    {"key": "user_id", "unique": false}  // ← NUEVO
  ],
  "required_fields": [
    "id", "product_id", "product_name", "quantity", "price",  // ← price agregado
    "total", "store", "payment_method", "user_id", "user_name",  // ← user_id y user_name agregados
    "created_at", "date"  // ← date agregado
  ]
}
```

**Campos críticos**:
- `date`: Para registro de ventas pasadas y calendario
- `price`: Precio unitario en el momento de la venta
- `user_id` / `user_name`: Auditoría de quién registró la venta

### 4. `expenses`
```json
{
  "indexes": [
    {"key": "id", "unique": true},
    {"key": "date", "unique": false},
    {"key": "category", "unique": false}
  ],
  "required_fields": [
    "id", "description", "amount", "category", "created_at"
  ]
}
```

### 5. `other_income`
```json
{
  "indexes": [
    {"key": "id", "unique": true},
    {"key": "date", "unique": false}
  ],
  "required_fields": [
    "id", "description", "amount", "created_at"
  ]
}
```

### 6. `customers`
```json
{
  "indexes": [
    {"key": "id", "unique": true},
    {"key": "name", "unique": false},
    {"key": "store", "unique": false},
    {"key": "email", "unique": false}  // ← NUEVO
  ],
  "required_fields": [
    "id", "name", "store", "total_spent", "purchase_count", "created_at"  // ← purchase_count agregado
  ]
}
```

### 7. `notes`
```json
{
  "indexes": [
    {"key": "id", "unique": true},
    {"key": "date", "unique": false},
    {"key": "author_id", "unique": false},
    {"key": "status", "unique": false}
  ],
  "required_fields": [
    "id", "date", "subject", "message", "author_id", "status", "created_at"
  ]
}
```

### 8. `note_reads`
```json
{
  "indexes": [
    {"key": "note_id", "unique": false},
    {"key": "user_id", "unique": false}
  ],
  "required_fields": [
    "note_id", "user_id", "read_at"
  ]
}
```

### 9. `settings`
```json
{
  "indexes": [
    {"key": "id", "unique": true}
  ],
  "required_fields": [
    "id", "store_a_name", "store_b_name", "created_at", "updated_at"
  ]
}
```

---

## 🎯 Funcionalidades que Dependen del Esquema

### Registro de Ventas Pasadas
**Requiere**: `sales.date`, `sales.user_id`, `sales.user_name`
- Permite registrar ventas con fechas retroactivas
- Mantiene auditoría de quién registró cada venta

### Calendario de Ventas
**Requiere**: `sales.date`, índice en `sales.date`
- Consultas rápidas por fecha específica
- Agrupación por día/mes/año

### Análisis por Usuario
**Requiere**: `sales.user_id`, índice en `sales.user_id`
- Reportes de ventas por empleado
- Auditoría de registros

### CRM - Clientes
**Requiere**: `customers.purchase_count`, `customers.email`
- Seguimiento de compras por cliente
- Comunicación vía email

### Inventario con Código de Barras
**Requiere**: `products.barcode`, índice en `products.barcode`
- Búsqueda rápida por código de barras
- Integración con scanners

---

## 🔧 Validación y Corrección Automática

La función **"Validar y Corregir Esquema"** realiza:

1. ✅ **Verifica 9 colecciones** del esquema esperado
2. ✅ **Crea colecciones faltantes** automáticamente
3. ✅ **Crea índices faltantes** para optimización
4. ✅ **Inicializa settings** si no existe
5. ✅ **NO modifica datos existentes** (solo estructura)
6. ✅ **Genera reporte detallado** de cambios

### Ejecución
- **Ubicación**: Configuración → Tab "Base de Datos"
- **Botón**: "Validar y Corregir Esquema"
- **Permisos**: Solo Administradores
- **Seguridad**: No elimina ni modifica datos

---

## 📊 Ejemplo de Reporte

```json
{
  "status": "fixed",
  "collections_checked": 9,
  "collections_created": [],
  "indexes_created": [
    {"collection": "sales", "field": "user_id", "unique": false},
    {"collection": "sales", "field": "date", "unique": false},
    {"collection": "products", "field": "barcode", "unique": false},
    {"collection": "customers", "field": "email", "unique": false}
  ],
  "message": "✅ Se realizaron 4 correcciones en el esquema.",
  "timestamp": "2026-07-14T22:00:00.000000+00:00"
}
```

---

## ⚠️ Importante para Mantenimiento

Cuando se agreguen nuevas funcionalidades que requieran:
- **Nuevos campos en colecciones existentes** → Actualizar `required_fields`
- **Nuevos índices para optimización** → Actualizar `indexes`
- **Nuevas colecciones** → Agregar entrada completa en `EXPECTED_SCHEMA`

**Archivo a modificar**: `/app/backend/routes/database.py`

---

## ✅ Estado Actual

- **Esquema actualizado**: ✅ Julio 14, 2026
- **Funcionalidades soportadas**:
  - ✅ Registro de ventas con fecha personalizada
  - ✅ Calendario de ventas histórico
  - ✅ Auditoría por usuario
  - ✅ CRM con contador de compras
  - ✅ Búsqueda por código de barras
  - ✅ Gestión de notas con seguimiento de lecturas
  
**El esquema está completo y actualizado con todas las funcionalidades recientes.**
