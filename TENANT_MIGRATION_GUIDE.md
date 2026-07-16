# 🔄 Migración Pendiente: Tenant Isolation en Endpoints

## 📋 Estado Actual

El sistema multi-tenant está parcialmente implementado:

✅ **Completado:**
- Modelo de cuentas (`accounts`) con planes, límites y módulos
- Super-admin funcional (carlos@tricomar.cl / QWEasd123$)
- Registro automático con cuentas freemium
- Router `/api/super-admin` completo
- Middleware de tenant isolation en `/app/backend/middleware/tenant.py`
- Helpers: `get_tenant_filter()` y `add_account_id_to_document()`

⚠️ **Pendiente:**
- Actualizar endpoints existentes para filtrar por `account_id`
- Agregar `account_id` a documentos nuevos en creación

---

## 🔧 Pasos para Migrar un Endpoint

### 1. Importar helpers de tenant

```python
from middleware.tenant import get_tenant_filter, add_account_id_to_document
```

### 2. En endpoints GET (listar/obtener datos)

**Antes:**
```python
@router.get("")
async def list_items(current_user: User = Depends(get_current_user)):
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    return items
```

**Después:**
```python
@router.get("")
async def list_items(current_user: User = Depends(get_current_user)):
    tenant_filter = get_tenant_filter(current_user.dict())
    items = await db.items.find(tenant_filter, {"_id": 0}).to_list(1000)
    return items
```

**Con filtros adicionales:**
```python
@router.get("")
async def list_items(store: str, current_user: User = Depends(get_current_user)):
    tenant_filter = get_tenant_filter(current_user.dict(), {"store": store})
    items = await db.items.find(tenant_filter, {"_id": 0}).to_list(1000)
    return items
```

### 3. En endpoints POST (crear datos)

**Antes:**
```python
@router.post("")
async def create_item(item_input: ItemCreate, current_user: User = Depends(get_current_user)):
    item = Item(**item_input.dict())
    doc = item.model_dump()
    await db.items.insert_one(doc)
    return item
```

**Después:**
```python
@router.post("")
async def create_item(item_input: ItemCreate, current_user: User = Depends(get_current_user)):
    item = Item(**item_input.dict())
    doc = item.model_dump()
    
    # Agregar account_id al documento
    doc = add_account_id_to_document(current_user.dict(), doc)
    
    await db.items.insert_one(doc)
    return item
```

### 4. En endpoints PUT/DELETE (actualizar/eliminar)

**Antes:**
```python
@router.delete("/{item_id}")
async def delete_item(item_id: str, current_user: User = Depends(get_current_user)):
    result = await db.items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return {"success": True}
```

**Después:**
```python
@router.delete("/{item_id}")
async def delete_item(item_id: str, current_user: User = Depends(get_current_user)):
    tenant_filter = get_tenant_filter(current_user.dict(), {"id": item_id})
    result = await db.items.delete_one(tenant_filter)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return {"success": True}
```

---

## 📁 Archivos a Migrar

### ⚠️ CRÍTICO (afectan datos del usuario):
- `/app/backend/routes/sales.py` - Ventas
- `/app/backend/routes/products.py` - Productos
- `/app/backend/routes/customers.py` - Clientes
- `/app/backend/routes/expenses.py` - Egresos
- `/app/backend/routes/income.py` - Otros Ingresos
- `/app/backend/routes/notes.py` - Notas

### 🔹 MEDIO (afectan funcionalidades):
- `/app/backend/routes/dashboard.py` - Dashboard/Métricas
- `/app/backend/routes/sales_records.py` - Registros históricos de ventas
- `/app/backend/routes/expenses_records.py` - Registros históricos de egresos
- `/app/backend/routes/income_records.py` - Registros históricos de ingresos

### ℹ️ BAJO (no afectan datos):
- `/app/backend/routes/settings.py` - Configuración
- `/app/backend/routes/users.py` - Gestión de usuarios (ya filtra por cuenta)

---

## 🗄️ Migración de Datos Existentes

Si hay datos existentes en la base de datos SIN `account_id`, ejecutar:

```python
# Script para migrar datos existentes a una cuenta por defecto
# /app/backend/scripts/migrate_existing_data.py

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def migrate():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    # Obtener una cuenta existente o crear una por defecto
    account = await db.accounts.find_one({})
    if not account:
        print("⚠️ No hay cuentas. Crear al menos una cuenta primero.")
        return
    
    default_account_id = account['id']
    print(f"Migrando datos a cuenta: {default_account_id}")
    
    # Colecciones a migrar
    collections = ['sales', 'products', 'customers', 'expenses', 'other_income', 'notes']
    
    for coll_name in collections:
        result = await db[coll_name].update_many(
            {"account_id": {"$exists": False}},
            {"$set": {"account_id": default_account_id}}
        )
        print(f"✅ {coll_name}: {result.modified_count} documentos migrados")
    
    client.close()

asyncio.run(migrate())
```

---

## 🎯 Próximos Pasos

1. **Inmediato:** Continuar con frontend (Panel Super-Admin)
2. **Medio plazo:** Migrar endpoints críticos (sales, products, etc.)
3. **Testing:** Verificar aislamiento de datos entre cuentas
4. **Producción:** Ejecutar script de migración de datos existentes

---

## 📝 Notas Importantes

- **Super-admin** puede ver datos de todas las cuentas (no se filtra por account_id)
- **Account admin y employees** solo ven datos de su cuenta
- Los helpers automáticamente manejan la lógica de super-admin vs usuarios normales
- NO modificar datos existentes manualmente, usar los helpers
