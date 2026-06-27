# 📝 Changelog de Esquema de Base de Datos

Este archivo documenta todos los cambios en el esquema de la base de datos.

---

## [Actual] - 2026-06-26

### Colecciones Existentes

#### 👥 `users`
- **Descripción**: Usuarios del sistema con autenticación
- **Campos**:
  - `id` (string, required): ID único del usuario
  - `email` (string, required): Email único
  - `password_hash` (string, required): Hash de contraseña
  - `name` (string, required): Nombre del usuario
  - `role` (string, required): Rol (admin, sub_admin, supervisor, empleado)
  - `created_at` (datetime, required): Fecha de creación
- **Índices**: `email`, `id`

#### 📦 `products`
- **Descripción**: Inventario de productos
- **Campos**:
  - `id` (string, required): ID único del producto
  - `name` (string, required): Nombre del producto
  - `cost_price` (float, required): Precio de costo
  - `sale_price` (float, required): Precio de venta
  - `store` (string, required): Tienda (A, B, Ambas)
  - `category` (string, required): Categoría del producto
  - `stock` (int, required): Cantidad en stock
  - `created_at` (datetime, required): Fecha de creación
  - `sku` (string, optional): Código SKU
  - `description` (string, optional): Descripción del producto
  - `updated_at` (datetime, optional): Última actualización
- **Índices**: `id`, `name`, `store`

#### 💰 `sales`
- **Descripción**: Registro de ventas realizadas
- **Campos**:
  - `id` (string, required): ID único de la venta
  - `product_id` (string, required): ID del producto vendido
  - `product_name` (string, required): Nombre del producto
  - `quantity` (int, required): Cantidad vendida
  - `total` (float, required): Total de la venta
  - `profit` (float, required): Ganancia de la venta
  - `payment_method` (string, required): Método de pago
  - `store` (string, required): Tienda donde se realizó
  - `date` (string, required): Fecha de la venta (YYYY-MM-DD)
  - `created_at` (datetime, required): Timestamp de creación
  - `customer_id` (string, optional): ID del cliente
  - `customer_name` (string, optional): Nombre del cliente
  - `has_tax` (bool, optional): Si incluye IVA
  - `cost_price` (float, optional): Precio de costo
  - `sale_price` (float, optional): Precio de venta unitario
- **Índices**: `id`, `product_id`, `customer_id`, `date`, `store`

#### 📉 `expenses`
- **Descripción**: Gastos del negocio
- **Campos**:
  - `id` (string, required): ID único del gasto
  - `description` (string, required): Descripción del gasto
  - `amount` (float, required): Monto del gasto
  - `category` (string, required): Categoría del gasto
  - `store` (string, required): Tienda asociada
  - `date` (string, required): Fecha del gasto (YYYY-MM-DD)
  - `created_at` (datetime, required): Timestamp de creación
  - `payment_method` (string, optional): Método de pago
  - `notes` (string, optional): Notas adicionales
- **Índices**: `id`, `date`, `store`, `category`

#### 📈 `income`
- **Descripción**: Otros ingresos (no ventas directas)
- **Campos**:
  - `id` (string, required): ID único del ingreso
  - `description` (string, required): Descripción del ingreso
  - `amount` (float, required): Monto del ingreso
  - `category` (string, required): Categoría del ingreso
  - `store` (string, required): Tienda asociada
  - `date` (string, required): Fecha del ingreso (YYYY-MM-DD)
  - `created_at` (datetime, required): Timestamp de creación
  - `payment_method` (string, optional): Método de pago
  - `notes` (string, optional): Notas adicionales
- **Índices**: `id`, `date`, `store`, `category`

#### 👤 `customers`
- **Descripción**: Clientes del sistema CRM
- **Campos**:
  - `id` (string, required): ID único del cliente
  - `name` (string, required): Nombre del cliente
  - `store` (string, required): Tienda principal (A, B, Ambas)
  - `total_spent` (float, required): Total gastado histórico
  - `created_at` (datetime, required): Fecha de creación
  - `address` (string, optional): Dirección o sector
  - `phone` (string, optional): Teléfono de contacto
  - `email` (string, optional): Email del cliente
  - `last_purchase_date` (string, optional): Última compra
  - `purchase_count` (int, optional): Número de compras
- **Índices**: `id`, `name`, `store`

#### 📝 `notes`
- **Descripción**: Notas diarias y calendario del equipo
- **Campos**:
  - `id` (string, required): ID único de la nota
  - `date` (string, required): Fecha de la nota (YYYY-MM-DD)
  - `subject` (string, required): Asunto de la nota
  - `message` (string, required): Contenido del mensaje
  - `author_id` (string, required): ID del autor
  - `status` (string, required): Estado (unread, read, pending, completed)
  - `created_at` (datetime, required): Timestamp de creación
  - `mentions` (array, optional): IDs de usuarios mencionados
  - `updated_at` (datetime, optional): Última actualización
  - `read_by` (array, optional): IDs de usuarios que leyeron
- **Índices**: `id`, `date`, `author_id`, `status`

#### ⚙️ `settings`
- **Descripción**: Configuración global de la aplicación
- **Campos**:
  - `id` (string, required): Siempre "settings"
  - `store_a_name` (string, required): Nombre personalizado Tienda A
  - `store_b_name` (string, required): Nombre personalizado Tienda B
  - `created_at` (datetime, required): Fecha de creación
  - `updated_at` (datetime, required): Última actualización
- **Índices**: `id`
- **Documento único**: Solo existe 1 documento con id="settings"

---

## Historial de Cambios

### 2026-06-25
#### Agregado
- ✅ Colección `customers` para módulo CRM
- ✅ Campos `customer_id` y `customer_name` en `sales` (opcionales)

### 2026-06-23
#### Agregado
- ✅ Colección `notes` para calendario diario
- ✅ Colección `settings` para configuración global

### 2026-06-20 (Inicial)
#### Agregado
- ✅ Esquema inicial con colecciones: users, products, sales, expenses, income
- ✅ Sistema de roles y autenticación
- ✅ Índices básicos para optimización

---

## 📋 Cómo actualizar este archivo

Cuando agregues nuevas colecciones o campos:

1. **Documenta el cambio** en la sección "Historial de Cambios"
2. **Actualiza la sección correspondiente** con los nuevos campos
3. **Ejecuta el validador** para confirmar:
   ```bash
   python /app/backend/migrations/schema_validator.py
   ```
4. **Actualiza** `EXPECTED_SCHEMA` en `schema_validator.py`
