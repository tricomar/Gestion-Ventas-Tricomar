# 🗄️ Sistema de Gestión de Esquema de Base de Datos

## 📋 Resumen

Este sistema te ayuda a:
- ✅ Detectar **automáticamente** cuando se agregan nuevos campos o tablas
- ✅ Mantener un **historial** de cambios en el esquema
- ✅ Aplicar **migraciones** de manera controlada
- ✅ Recibir **notificaciones** cuando el esquema cambia
- ✅ Mantener la **documentación** sincronizada con la implementación

---

## 🚀 Inicio Rápido (5 minutos)

### 1. Validar tu base de datos actual
```bash
python /app/backend/migrations/schema_validator.py
```

### 2. Ver el changelog de cambios
```bash
cat /app/SCHEMA_CHANGELOG.md
```

### 3. Si hay cambios detectados, lee la guía
```bash
cat /app/backend/migrations/GUIA_USO.md
```

---

## 📁 Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `/app/SCHEMA_CHANGELOG.md` | 📖 **Historial completo** de cambios en la BD |
| `/app/backend/migrations/schema_validator.py` | 🔍 **Validador** que detecta cambios |
| `/app/backend/migrations/migrate.py` | 🔄 **Aplica migraciones** pendientes |
| `/app/backend/migrations/create_migration.py` | ➕ **Crea nuevas** migraciones |
| `/app/backend/migrations/GUIA_USO.md` | 📚 **Guía detallada** de uso |
| `/app/backend/check_schema_on_startup.py` | 🔔 **Validación automática** al iniciar servidor |

---

## 🔔 ¿Cómo me notifica de cambios?

### Opción 1: Validación Manual
```bash
# Ejecuta esto después de hacer cambios en tus modelos
python /app/backend/migrations/schema_validator.py
```

**Output ejemplo:**
```
🆕 CAMPOS NUEVOS DETECTADOS:
   - customers: last_purchase_date, purchase_count

⚡ ACCIÓN REQUERIDA: Actualiza EXPECTED_SCHEMA en schema_validator.py
```

### Opción 2: Validación Automática al Iniciar Servidor

Edita `/app/backend/server.py` y agrega estas líneas al inicio:

```python
# Importar al inicio del archivo
from check_schema_on_startup import check_schema

# Justo después de crear la app FastAPI
app = FastAPI(title="Sales Management API")

# Agregar validación de esquema
check_schema()
```

Esto validará tu esquema **cada vez que inicies el servidor** y te alertará si hay cambios.

---

## 🎯 Flujo de Trabajo Típico

### Escenario: Agregaste un campo nuevo a "customers"

1. **Detectar el cambio:**
   ```bash
   python /app/backend/migrations/schema_validator.py
   ```

2. **Crear migración:**
   ```bash
   python /app/backend/migrations/create_migration.py "agregar_campo_email_a_customers"
   ```

3. **Editar la migración** creada y agregar tu lógica:
   ```python
   def up():
       client = MongoClient(MONGO_URL)
       db = client[DB_NAME]
       
       # Agregar campo email a todos los clientes existentes
       db.customers.update_many(
           {},
           {"$set": {"email": None}}
       )
       
       # Resto del código de la migración...
   ```

4. **Ejecutar migración:**
   ```bash
   python /app/backend/migrations/migration_XXXXX_agregar_campo_email_a_customers.py
   ```

5. **Actualizar documentación:**
   - Edita `/app/backend/migrations/schema_validator.py` y agrega "email" a `optional_fields` de customers
   - Edita `/app/SCHEMA_CHANGELOG.md` y documenta el cambio

6. **Validar que todo esté sincronizado:**
   ```bash
   python /app/backend/migrations/schema_validator.py
   ```
   
   Deberías ver: `✅ ¡TODO EN ORDEN! El esquema está actualizado.`

---

## 📊 Esquema Actual (Resumen)

Tu aplicación tiene estas colecciones principales:

| Colección | Documentos | Descripción |
|-----------|------------|-------------|
| `users` | 👥 Usuarios | Sistema de autenticación y roles |
| `products` | 📦 Productos | Inventario de productos |
| `sales` | 💰 Ventas | Registro de ventas |
| `expenses` | 📉 Gastos | Gastos del negocio |
| `income` | 📈 Ingresos | Otros ingresos |
| `customers` | 👤 Clientes | CRM de clientes |
| `notes` | 📝 Notas | Calendario y notas diarias |
| `settings` | ⚙️ Config | Configuración global |

**Ver detalles completos:** `/app/SCHEMA_CHANGELOG.md`

---

## ⚙️ Configuración del Sistema

### Índices Automáticos

El sistema crea estos índices automáticamente:
- `users`: email, id
- `products`: id, name, store
- `sales`: id, product_id, customer_id, date, store
- `customers`: id, name, store
- `notes`: id, date, author_id, status
- Y más...

### Colecciones Especiales

**`migrations`**: Registra todas las migraciones aplicadas
- Creada automáticamente al ejecutar `migrate.py`
- No borrar ni modificar manualmente

**`settings`**: Documento único con configuración global
- Solo debe existir 1 documento con `id = "settings"`
- Se crea automáticamente si no existe

---

## 🛠️ Comandos Útiles

### Ver migraciones aplicadas
```bash
python -c "from pymongo import MongoClient; import os; from dotenv import load_dotenv; load_dotenv('/app/backend/.env'); client = MongoClient(os.environ.get('MONGO_URL')); [print(f\"✅ {m['name']}\") for m in client['sales_management'].migrations.find({}, {'_id': 0})]"
```

### Contar documentos por colección
```bash
python -c "from pymongo import MongoClient; import os; from dotenv import load_dotenv; load_dotenv('/app/backend/.env'); client = MongoClient(os.environ.get('MONGO_URL')); db = client['sales_management']; [print(f'{c}: {db[c].count_documents({})} docs') for c in db.list_collection_names()]"
```

### Ver último reporte de validación
```bash
cat /app/backend/migrations/last_validation.json | python -m json.tool
```

---

## 📞 Necesitas Ayuda?

1. **Lee la guía completa:**
   ```bash
   cat /app/backend/migrations/GUIA_USO.md
   ```

2. **Revisa el changelog:**
   ```bash
   cat /app/SCHEMA_CHANGELOG.md
   ```

3. **Ejecuta el validador:**
   ```bash
   python /app/backend/migrations/schema_validator.py
   ```

---

## 🎓 Buenas Prácticas

✅ **Hazlo:**
- Ejecuta el validador después de cada cambio importante en modelos
- Documenta cada cambio en SCHEMA_CHANGELOG.md
- Crea migraciones para cambios que afecten datos existentes
- Mantén EXPECTED_SCHEMA sincronizado

❌ **No hagas:**
- Modificar colecciones sin documentar
- Ignorar las alertas del validador
- Borrar la colección `migrations`
- Eliminar migraciones ya aplicadas

---

## 📈 Próximos Pasos

1. ✅ Ejecuta la validación inicial (ya hecho)
2. ⚙️ Configura la validación automática al iniciar el servidor
3. 📖 Lee la guía completa en `GUIA_USO.md`
4. 🔄 Establece un flujo de trabajo con tu equipo

---

**¡Listo!** 🎉 Tu sistema de gestión de esquema está configurado y funcionando.
