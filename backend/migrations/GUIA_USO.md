# 📚 Guía de Uso del Sistema de Migraciones

## 🚀 Inicio Rápido

### 1. Validar el esquema actual
```bash
python /app/backend/migrations/schema_validator.py
```

Este comando te mostrará:
- ✅ Colecciones existentes y su estado
- 🆕 Nuevos campos o colecciones detectados
- ⚠️ Campos faltantes
- 📊 Estadísticas de documentos

### 2. Aplicar migraciones iniciales
```bash
python /app/backend/migrations/migrate.py
```

Este comando:
- Crea índices necesarios en todas las colecciones
- Inicializa el documento de settings si no existe
- Registra las migraciones aplicadas

---

## 📝 Workflow Completo

### Cuando agregas un nuevo campo o tabla:

#### Paso 1: Detectar cambios
```bash
python /app/backend/migrations/schema_validator.py
```

**Salida ejemplo:**
```
🆕 CAMPOS NUEVOS DETECTADOS:
   - customers: last_purchase_date, purchase_count

⚡ ACCIÓN REQUERIDA: Actualiza EXPECTED_SCHEMA en schema_validator.py
```

#### Paso 2: Crear una migración
```bash
python /app/backend/migrations/create_migration.py "agregar_analytics_clientes"
```

Esto crea un archivo como:
`migration_20260626_123045_agregar_analytics_clientes.py`

#### Paso 3: Editar la migración
Abre el archivo creado y completa la función `up()`:

```python
def up():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Agregar campos nuevos a documentos existentes
        db.customers.update_many(
            {},
            {
                "$set": {
                    "last_purchase_date": None,
                    "purchase_count": 0
                }
            }
        )
        
        # Crear índice si es necesario
        db.customers.create_index('last_purchase_date')
        
        print("✅ Campos agregados a customers")
        
        # Registrar migración
        db.migrations.insert_one({
            'name': 'migration_20260626_123045_agregar_analytics_clientes.py',
            'applied_at': datetime.now().isoformat(),
            'description': 'agregar_analytics_clientes'
        })
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        client.close()
```

#### Paso 4: Ejecutar la migración
```bash
python /app/backend/migrations/migration_20260626_123045_agregar_analytics_clientes.py
```

#### Paso 5: Actualizar documentación

**A. Actualiza** `/app/backend/migrations/schema_validator.py`:
```python
EXPECTED_SCHEMA = {
    'customers': {
        'required_fields': ['id', 'name', 'store', 'total_spent', 'created_at'],
        'optional_fields': ['address', 'phone', 'email', 'last_purchase_date', 'purchase_count'],  # ← AGREGAR AQUÍ
        'indexes': ['id', 'name', 'store', 'last_purchase_date'],  # ← Y AQUÍ
        'description': 'Clientes del CRM'
    },
    # ...
}
```

**B. Actualiza** `/app/SCHEMA_CHANGELOG.md`:
```markdown
## [2026-06-26]

### Modificado
- ✏️ Colección `customers`:
  - Agregado campo `last_purchase_date` (datetime, optional): Fecha de última compra
  - Agregado campo `purchase_count` (int, optional): Contador de compras
  - Agregado índice en `last_purchase_date`
```

#### Paso 6: Validar cambios
```bash
python /app/backend/migrations/schema_validator.py
```

Deberías ver:
```
✅ ¡TODO EN ORDEN! El esquema está actualizado.
```

---

## 🔔 Sistema de Notificaciones Automáticas

### Opción 1: Validación al inicio del servidor (Recomendado)

Edita `/app/backend/server.py` y agrega al inicio:

```python
# Al inicio del archivo, después de los imports
from check_schema_on_startup import check_schema

# Justo antes de los endpoints
check_schema()
```

Esto validará el esquema cada vez que inicies el servidor.

### Opción 2: Hook de Git (Pre-commit)

Crea un hook de git que valide antes de cada commit:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
python /app/backend/migrations/schema_validator.py
if [ $? -ne 0 ]; then
    echo "⚠️  Hay cambios en el esquema - revisa antes de commitear"
fi
EOF

chmod +x .git/hooks/pre-commit
```

### Opción 3: Cron Job diario

```bash
# Agregar a crontab
0 9 * * * python /app/backend/migrations/schema_validator.py >> /var/log/schema_validation.log 2>&1
```

---

## 🛠️ Comandos Útiles

### Ver migraciones aplicadas
```bash
python -c "
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = MongoClient(os.environ.get('MONGO_URL'))
db = client['sales_management']

migrations = list(db.migrations.find({}, {'_id': 0}))
for m in migrations:
    print(f\"✅ {m['name']} - {m['applied_at']}\")
"
```

### Ver estado actual de una colección
```bash
python -c "
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = MongoClient(os.environ.get('MONGO_URL'))
db = client['sales_management']

# Cambiar 'customers' por la colección que quieras inspeccionar
sample = db.customers.find_one()
if sample:
    print('Campos existentes:')
    for key in sample.keys():
        if key != '_id':
            print(f'  - {key}')
"
```

### Contar documentos por colección
```bash
python -c "
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = MongoClient(os.environ.get('MONGO_URL'))
db = client['sales_management']

for coll_name in db.list_collection_names():
    count = db[coll_name].count_documents({})
    print(f'{coll_name}: {count} documentos')
"
```

---

## ⚠️ Mejores Prácticas

### ✅ DO:
- Siempre valida el esquema después de hacer cambios en los modelos
- Documenta cada cambio en SCHEMA_CHANGELOG.md
- Prueba las migraciones en desarrollo antes de producción
- Mantén EXPECTED_SCHEMA sincronizado con tu código
- Usa nombres descriptivos para las migraciones

### ❌ DON'T:
- No elimines migraciones ya aplicadas
- No modifiques migraciones después de aplicarlas
- No agregues campos requeridos sin valores default
- No olvides crear índices para campos que se consultan frecuentemente
- No ignores las alertas del validador

---

## 🐛 Troubleshooting

### Problema: "Collection not found"
**Solución**: La colección aún no existe. Crea un documento primero o ejecuta la migración inicial.

### Problema: "Duplicate key error"
**Solución**: Ya existe un documento con ese ID. Verifica el índice unique.

### Problema: "No se detectan cambios"
**Solución**: Asegúrate de que hay documentos en la colección. El validador necesita al menos 1 documento para detectar campos.

---

## 📞 Soporte

Si encuentras problemas o tienes dudas:
1. Revisa el archivo `/app/backend/migrations/last_validation.json` para detalles
2. Verifica los logs de MongoDB
3. Ejecuta el validador con verbose mode (si lo implementas)
