# Flujo Completo de Integración PrestaShop

## 📊 Estado Actual de Integraciones

### Versiones PrestaShop Activas:
- **tricomar.cl**: PrestaShop 1.7.8.11
  - Documentación API: https://devdocs.prestashop-project.org/1.7/webservice/resources/
  
- **tricomarpets.cl**: PrestaShop 8.2.4
  - Documentación API: https://devdocs.prestashop-project.org/8/webservice/resources/

### Diferencias Clave entre Versiones:
- **Ambas versiones** usan WebService API (XML/JSON)
- **PrestaShop 8.x** añade soporte PATCH para actualizaciones parciales
- **PrestaShop 8.x** introduce Admin API (opcional, más moderna)
- Recursos principales (`products`, `orders`, `categories`) funcionan igual en ambas versiones
- Estructura de datos es compatible entre versiones

---

## 🔄 FLUJO COMPLETO DE INTEGRACIÓN

### 1️⃣ **CONFIGURACIÓN INICIAL** (Frontend → Backend)

**Ruta**: Configuración → Integraciones → "Conectar con PrestaShop"

#### Frontend (`/app/frontend/src/components/settings/IntegrationsTab.js`):
- Usuario hace clic en "Conectar con PrestaShop"
- Se abre modal `PrestashopModal.js`
- Usuario ingresa:
  - Selecciona Tienda (dropdown de `account.stores`)
  - URL de la tienda PrestaShop
  - API Key de PrestaShop

#### Backend (`/app/backend/routes/integrations.py`):

**Endpoint**: `POST /api/integrations/prestashop/connect`

```python
@router.post("/prestashop/connect")
async def connect_prestashop(request: PrestashopConnectRequest, current_user: User):
    # 1. Busca la tienda en account.stores
    # 2. Si no existe, CREA automáticamente la tienda
    # 3. Valida conexión con PrestaShop (test_connection)
    # 4. Guarda integración en `prestashop_integrations`:
    {
        'id': uuid4(),
        'account_id': current_user.account_id,
        'store_id': request.store_id,  # ID de la tienda
        'shop_url': request.shop_url,
        'api_key': request.api_key,
        'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
```

**Colección creada**: `prestashop_integrations`

---

### 2️⃣ **SINCRONIZACIÓN DE RECURSOS**

#### A. CATEGORÍAS

**Endpoint**: `POST /api/integrations/prestashop/{integration_id}/sync-categories`

**Flujo**:
1. Obtiene integración por `integration_id`
2. Crea servicio PrestaShop con `shop_url` y `api_key`
3. Llama `ps_service.get_categories(limit=500)`
4. Para cada categoría de PrestaShop:
   - Guarda en `prestashop_categories`:
     ```python
     {
         'account_id': account_id,
         'integration_id': integration_id,
         'id': cat['id'],
         'name': cat['name'],
         'id_parent': cat['id_parent'],
         'level_depth': cat['level_depth'],
         'active': cat['active'],
         'synced_at': datetime.now(timezone.utc).isoformat()
     }
     ```
5. También inserta en `categories` (colección local de Negocio Feliz)

**Colecciones afectadas**:
- `prestashop_categories`
- `categories`

---

#### B. PRODUCTOS

**Endpoint**: `POST /api/integrations/prestashop/{integration_id}/sync-products`

**Flujo**:
1. Crea job en `sync_jobs` con estado 'running'
2. Ejecuta sincronización en background
3. Obtiene productos de PrestaShop con `ps_service.get_products_batch(limit=50, offset=X)`
4. Para cada producto:
   - Guarda en `prestashop_products`
   - **Busca/crea en `products` (inventario local)**:
     ```python
     {
         'id': uuid4(),
         'account_id': account_id,
         'name': product_name,
         'sku': product_sku,
         'stock': product_stock,
         'price': product_price,
         'store': store_code,  # Código de tienda (ej: "GS", "PS")
         'prestashop_id': product_id,
         'prestashop_integration_id': integration_id,
         'ecommerce_active': True/False,
         'category': product_category
     }
     ```
5. Actualiza job con progreso

**Colecciones afectadas**:
- `prestashop_products`
- `products` (inventario local)
- `sync_jobs`

---

#### C. ÓRDENES / PEDIDOS

**Endpoint**: `POST /api/integrations/prestashop/{integration_id}/sync-orders`

**Flujo**:
1. Obtiene órdenes de PrestaShop con `ps_service.get_orders(limit=500)`
2. Para cada orden:
   - Guarda en `ecommerce_orders`:
     ```python
     {
         'account_id': account_id,
         'integration_id': integration_id,
         'store_id': store_id,  # ⚠️ DEBE agregarse (actualmente falta)
         'id': str(order_id),
         'reference': order_reference,
         'customer_id': customer_id,
         'customer_name': customer_name,
         'total_paid': total_paid,
         'current_state': state_id,
         'payment_method': payment_method,
         'date_add': date_add,
         'synced_at': datetime.now(timezone.utc).isoformat()
     }
     ```

**⚠️ PROBLEMA IDENTIFICADO**:
- Las órdenes NO tienen `store_id`
- Solo tienen `integration_id`
- Esto causa que el filtrado por tienda en frontend no funcione correctamente

**Colecciones afectadas**:
- `ecommerce_orders`

---

#### D. CLIENTES

**Endpoint**: Parte de sincronización general

**Flujo**:
1. Obtiene clientes de PrestaShop
2. Para cada cliente:
   - Busca en `customers` local por email
   - Si existe: actualiza
   - Si no existe: crea nuevo cliente local con `prestashop_id`

**Colecciones afectadas**:
- `ecommerce_customers` (datos ecommerce)
- `customers` (CRM local)

---

### 3️⃣ **VISUALIZACIÓN EN FRONTEND**

#### Módulo Ecommerce (`/app/frontend/src/pages/EcommercePage.js`)

**Endpoint**: `GET /api/ecommerce/orders?store_id={store_id}`

**Backend** (`/app/backend/routes/ecommerce.py`):
```python
@router.get("/orders")
async def get_orders(store_id: str = None, current_user: User):
    tenant_filter = get_tenant_filter(current_user.dict(), {})
    
    # Filtrar por store_id si se proporciona
    if store_id:
        tenant_filter["store_id"] = store_id  # ⚠️ Este campo falta en órdenes
    
    orders = await db.ecommerce_orders.find(tenant_filter, {"_id": 0}).to_list(1000)
    return orders
```

**⚠️ PROBLEMA**:
- El filtro por `store_id` NO funciona porque las órdenes no tienen este campo
- Solo tienen `integration_id`

**Solución necesaria**:
1. Al sincronizar órdenes, añadir `store_id` desde la integración
2. Migrar órdenes existentes para añadir `store_id`

---

## 🗄️ ESTRUCTURA DE DATOS

### Colecciones MongoDB:

```
prestashop_integrations
├── id (UUID)
├── account_id
├── store_id → Relación con account.stores
├── shop_url
├── api_key
└── is_active

ecommerce_orders
├── account_id
├── integration_id → prestashop_integrations.id
├── store_id ⚠️ FALTA - debe agregarse
├── id (order ID de PrestaShop)
├── reference
├── customer_id
├── total_paid
├── current_state
└── date_add

products (inventario local)
├── id (UUID)
├── account_id
├── name
├── sku
├── stock
├── store → store_code ("GS", "PS", etc.)
├── prestashop_id
└── prestashop_integration_id

prestashop_products
├── account_id
├── integration_id
├── id (product ID de PrestaShop)
├── name
├── reference (SKU)
├── quantity
└── price

categories
├── id (UUID)
├── account_id
├── name
├── store → store name
└── created_at

prestashop_categories
├── account_id
├── integration_id
├── id (category ID de PrestaShop)
├── name
├── id_parent
└── level_depth
```

---

## 🔧 SERVICIOS

### PrestashopAPIService (`/app/backend/services/prestashop_service.py`)

**Métodos principales**:
- `test_connection()`: Valida API Key
- `get_products(limit)`: Obtiene productos
- `get_products_batch(limit, offset)`: Paginación de productos
- `get_categories(limit)`: Obtiene categorías
- `get_orders(limit)`: Obtiene órdenes
- `get_order_details(order_id)`: Detalle de orden
- `get_customers(limit)`: Obtiene clientes
- `update_product_stock(product_id, quantity)`: Actualiza stock
- `update_product_active(product_id, active)`: Publica/despublica producto

**Configuración**:
- URL base: `{shop_url}/api`
- Autenticación: HTTPBasicAuth(api_key, '')
- Formato salida: JSON (output_format=JSON)

---

## ⚠️ PROBLEMAS IDENTIFICADOS Y SOLUCIONES

### 1. **Órdenes sin store_id**

**Problema**: Órdenes no tienen campo `store_id`, solo `integration_id`

**Impacto**: Filtrado por tienda no funciona en módulo Ecommerce

**Solución**:
```python
# En sync_orders_resource():
order_data = {
    'account_id': account_id,
    'integration_id': integration_id,
    'store_id': integration['store_id'],  # ✅ Añadir desde integración
    'id': str(order_id),
    # ... resto de campos
}
```

### 2. **Diferencias entre PrestaShop 1.7 vs 8.x**

**Problema**: Pueden existir diferencias sutiles en estructura de respuestas API

**Solución**: 
- Validar campos opcionales con `.get()` siempre
- Manejar errores gracefully
- Logging detallado de respuestas

### 3. **Toggle "Publicado Ecommerce" no actualiza PrestaShop**

**Problema**: Cambio local no se refleja en tienda

**Solución**:
- Usar `integration_id` del producto para obtener integración correcta
- Llamar `update_product_active()` con credenciales correctas
- Validar versión de PrestaShop (1.7 vs 8)

---

## 🆕 NUEVA FUNCIONALIDAD: Borrar Contenido Sincronizado

**Endpoint**: `DELETE /api/integrations/prestashop/{integration_id}/clear-data`

**Acceso**: Solo `account_admin`

**Funcionalidad**:
- Borra TODO el contenido sincronizado de una integración
- **NO** elimina la configuración de la integración
- Permite volver a sincronizar desde cero

**Colecciones limpiadas**:
- `ecommerce_orders`
- `ecommerce_customers`
- `ecommerce_carts`
- `prestashop_products`
- `prestashop_categories`
- `prestashop_orders`
- `stock_conflicts`

**Frontend**: 
- Botón naranja con ícono de base de datos (Database)
- Solo visible para `account_admin`
- Ubicación: Configuración → Integraciones

---

## 📝 PRÓXIMOS PASOS

1. ✅ **Añadir `store_id` a órdenes** al sincronizar
2. **Migrar órdenes existentes** para añadir `store_id` desde su `integration_id`
3. **Validar sincronización** por versión de PrestaShop (1.7 vs 8.x)
4. **Probar toggle Publicado** en ambas versiones
5. **Implementar webhook** real para sincronización en tiempo real
6. **Optimizar polling** de órdenes nuevas

---

## 🧪 TESTING

### Probar flujo completo:
1. Conectar nueva integración
2. Sincronizar categorías
3. Sincronizar productos (verificar límites)
4. Sincronizar órdenes
5. Ver en Ecommerce filtrado por tienda
6. Toggle producto Publicado/Despublicado
7. Borrar contenido sincronizado
8. Re-sincronizar
