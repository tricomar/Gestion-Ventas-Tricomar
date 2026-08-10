# Arquitectura Multi-Tenant Genérica - Negocio Feliz

## 🎯 Principio Fundamental

**El sistema es 100% agnóstico a nombres de tiendas específicas.**

Toda la lógica funciona con identificadores dinámicos:
- `store_id`: Identificador único de tienda
- `tenant_id` / `account_id`: Identificador de cuenta/tenant
- `integration_id`: Identificador de integración externa

---

## 🏗️ Modelo de Datos Multi-Tenant

### 1. Account (Tenant Root)
```json
{
  "id": "acc_xxx",
  "email": "usuario@negocio.cl",
  "stores": [
    {
      "id": "store_xxx",
      "name": "Mi Tienda 1",  // Nombre editable por usuario
      "code": "T1",
      "type": "hybrid",  // physical | ecommerce | hybrid
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Fuente de verdad:** `account.stores` es la única fuente de nombres de tiendas.

---

### 2. Integraciones (Agnósticas)
```json
{
  "id": "int_xxx",
  "account_id": "acc_xxx",
  "store_id": "store_xxx",  // Vinculación a tienda
  "platform": "prestashop",  // prestashop | woocommerce | shopify | jumpseller
  "shop_url": "https://mitienda.com",
  "api_key": "encrypted_key",
  "is_active": true,
  "version": "8.2.4",  // Versión de la plataforma
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Regla:** Una integración se vincula a UNA tienda mediante `store_id`.

---

### 3. Productos (Inventario Local)
```json
{
  "id": "prod_xxx",
  "account_id": "acc_xxx",
  "name": "Producto Ejemplo",
  "sku": "SKU001",
  "stock": 50,
  "price": 10000,
  "store": "store_xxx",  // Código/ID de tienda
  
  // Vinculación a integración (opcional)
  "ecommerce_integration_id": "int_xxx",
  "ecommerce_id": "123",  // ID en plataforma externa
  "ecommerce_active": true,
  
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Regla:** Un producto pertenece a UNA tienda. Si está sincronizado, tiene `ecommerce_integration_id`.

---

### 4. Órdenes (Ecommerce)
```json
{
  "id": "order_xxx",
  "account_id": "acc_xxx",
  "store_id": "store_xxx",  // ⚠️ OBLIGATORIO
  "integration_id": "int_xxx",
  
  "reference": "ORD-001",
  "customer_name": "Cliente Ejemplo",
  "total_paid": 50000,
  "status": "completed",
  
  "items": [...],
  "date_add": "2024-01-01T00:00:00Z",
  "synced_at": "2024-01-01T00:00:00Z"
}
```

**Regla:** Toda orden DEBE tener `store_id` y `integration_id` para filtrado correcto.

---

### 5. Categorías
```json
{
  "id": "cat_xxx",
  "account_id": "acc_xxx",
  "integration_id": "int_xxx",  // Si es sincronizada
  
  "name": "Categoría Ejemplo",
  "parent_id": null,
  "level": 1,
  
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### 6. Clientes (Ecommerce)
```json
{
  "id": "cust_xxx",
  "account_id": "acc_xxx",
  "integration_id": "int_xxx",
  
  "firstname": "Juan",
  "lastname": "Pérez",
  "email": "juan@example.com",
  
  "synced_at": "2024-01-01T00:00:00Z"
}
```

---

### 7. Carritos
```json
{
  "id": "cart_xxx",
  "account_id": "acc_xxx",
  "integration_id": "int_xxx",
  
  "customer_id": "cust_xxx",
  "total": 30000,
  "abandoned": true,
  
  "items": [...],
  "date_add": "2024-01-01T00:00:00Z"
}
```

---

## 🔄 Flujo de Sincronización (Modelo Maestro)

### Fase 1: Configuración Inicial

**Usuario:**
1. Va a Configuración → Tiendas/Cajas
2. Edita nombre de tienda (ej: "Mi Negocio Online")
3. El nombre se guarda en `account.stores[0].name`

**Sistema:**
- Este nombre se usa en TODO el sistema (POS, Dashboard, Ecommerce, etc.)
- NO hay nombres hardcodeados

---

### Fase 2: Conectar Integración

**Endpoint:** `POST /api/integrations/{platform}/connect`

```python
{
  "store_id": "store_xxx",  # Seleccionado por usuario
  "shop_url": "https://mitienda.com",
  "api_key": "key_xxx",
  "platform": "prestashop"  # prestashop | woocommerce | shopify
}
```

**Proceso:**
1. Valida credenciales contra la plataforma
2. Detecta versión automáticamente
3. Guarda integración vinculada a `store_id`
4. Crea registro en `prestashop_integrations` / `woocommerce_integrations` / etc.

---

### Fase 3: Sincronización Unidireccional (Plataforma → Negocio Feliz)

**Orden:**
1. **Categorías** → `/api/integrations/{platform}/{integration_id}/sync-categories`
2. **Productos** → `/api/integrations/{platform}/{integration_id}/sync-products`
3. **Órdenes** → `/api/integrations/{platform}/{integration_id}/sync-orders`
4. **Clientes** → Sincronizado con órdenes
5. **Carritos** → `/api/integrations/{platform}/{integration_id}/sync-carts`

**Reglas:**
- Cada sincronización añade `integration_id` a los registros
- Productos sincronizados se añaden al inventario local con `ecommerce_integration_id`
- Órdenes DEBEN tener `store_id` desde la integración

---

### Fase 4: Sincronización Bidireccional (Real-Time)

#### A. Negocio Feliz → Plataforma

**Trigger: Venta POS**
```python
# POST /api/sales/
# Después de crear venta:
if product.ecommerce_integration_id:
    integration = get_integration(product.ecommerce_integration_id)
    await sync_stock_to_platform(integration, product)
```

**Trigger: Toggle "Publicado Ecommerce"**
```python
# PATCH /api/products/{product_id}/toggle-ecommerce
if product.ecommerce_integration_id:
    integration = get_integration(product.ecommerce_integration_id)
    await platform_service.update_product_active(
        product.ecommerce_id,
        active=new_state
    )
```

---

#### B. Plataforma → Negocio Feliz

**Opción 1: Polling (cada 30-60 segundos)**
```python
# Background task
async def poll_new_orders(integration_id):
    last_sync = get_last_sync_time(integration_id)
    new_orders = platform_service.get_orders(date_from=last_sync)
    
    for order in new_orders:
        await save_order_with_store_id(order, integration)
```

**Opción 2: Webhooks (Recomendado)**
```python
# POST /api/webhooks/{platform}/{integration_id}/order
async def receive_webhook(integration_id, payload):
    integration = get_integration(integration_id)
    order = parse_platform_order(payload, integration.platform)
    
    # Añadir store_id desde integración
    order['store_id'] = integration.store_id
    await save_order(order)
```

---

## 🔌 Preparación Multi-Plataforma

### Estructura de Servicios

```
/app/backend/services/
├── ecommerce_base.py          # Clase base abstracta
├── prestashop_service.py      # Implementación PrestaShop
├── woocommerce_service.py     # Implementación WooCommerce (futuro)
├── shopify_service.py         # Implementación Shopify (futuro)
└── jumpseller_service.py      # Implementación Jumpseller (futuro)
```

**Clase Base:**
```python
class EcommerceService(ABC):
    @abstractmethod
    async def test_connection(self) -> bool:
        pass
    
    @abstractmethod
    async def get_products(self, limit: int) -> List[dict]:
        pass
    
    @abstractmethod
    async def get_orders(self, limit: int) -> List[dict]:
        pass
    
    @abstractmethod
    async def update_product_stock(self, product_id, quantity) -> bool:
        pass
```

---

### Rutas Genéricas

```python
# Actual:
@router.post("/prestashop/connect")

# Futuro (Agnóstico):
@router.post("/{platform}/connect")
async def connect_platform(
    platform: str,  # prestashop | woocommerce | shopify
    request: IntegrationRequest
):
    service = get_service_for_platform(platform)
    # ...
```

---

## 📊 Filtrado Multi-Tenant

### Frontend: Selector de Tienda

**Componente:** `useStores()` hook

```javascript
const { stores, currentStore, setCurrentStore } = useStores();

// stores viene de account.stores
// currentStore es store_id seleccionado
```

**Aplicar filtro:**
```javascript
// En cualquier módulo (Inventario, Ecommerce, POS)
const products = await axios.get(`${API}/products?store=${currentStore}`);
const orders = await axios.get(`${API}/ecommerce/orders?store_id=${currentStore}`);
```

---

### Backend: Filtro por Tenant

**Middleware automático:**
```python
def get_tenant_filter(user: dict, additional_filters: dict = {}) -> dict:
    base_filter = {"account_id": user["account_id"]}
    base_filter.update(additional_filters)
    return base_filter
```

**Uso en endpoints:**
```python
@router.get("/products")
async def get_products(
    store: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    filter = get_tenant_filter(current_user.dict())
    
    if store:
        filter["store"] = store
    
    products = await db.products.find(filter).to_list(1000)
    return products
```

---

## ✅ Checklist Multi-Tenant

### Código Limpio
- [x] Eliminadas referencias a "PetShop" y "GrowShop" del código
- [x] Eliminados archivos legacy (stores.py, seed scripts)
- [x] Sin nombres hardcodeados en variables
- [x] Sin rutas con nombres específicos de tiendas

### Base de Datos
- [x] Todas las colecciones limpias (0 registros)
- [x] Usuarios preservados
- [x] Datos huérfanos eliminados

### Arquitectura
- [x] Modelo de datos documentado
- [x] Flujo de sincronización definido
- [x] Preparación para multi-plataforma
- [ ] Implementar clase base EcommerceService
- [ ] Webhooks configurados
- [ ] Polling en background

---

## 🚀 Próximos Pasos: Modelo Maestro

1. **Configurar UNA tienda:**
   - Crear/editar tienda en Configuración
   - Conectar integración PrestaShop
   - Sincronizar categorías, productos, órdenes

2. **Probar sincronización bidireccional:**
   - Venta POS → actualiza stock en PrestaShop
   - Toggle publicado → cambia estado en PrestaShop
   - Nueva orden en PrestaShop → aparece en Negocio Feliz
   
3. **Validar filtrado:**
   - Crear segunda tienda/integración
   - Verificar que datos NO se mezclen
   - Confirmar que nombres dinámicos funcionen

4. **Una vez perfecto:**
   - Replicar para WooCommerce
   - Replicar para Shopify
   - Replicar para Jumpseller

---

## 📝 Notas Importantes

- **Nunca** hardcodear nombres de tiendas en código
- **Siempre** obtener nombres de `account.stores`
- **Cada integración** debe tener `store_id`
- **Cada dato sincronizado** debe tener `integration_id` y `account_id`
- **Filtrado por tienda** es obligatorio en todos los módulos
- **store_id** es la clave para separación de datos

---

## 🎯 Objetivo Final

Un sistema donde:
- Un usuario puede tener N tiendas
- Cada tienda puede tener M integraciones
- Los datos están perfectamente separados
- La sincronización es bidireccional y en tiempo real
- Cualquier plataforma (PrestaShop, WooCommerce, Shopify) funciona con la misma lógica
- Todo es dinámico y configurable por el usuario

**Sin nombres hardcodeados. Sin lógica específica por tienda. 100% genérico.**
