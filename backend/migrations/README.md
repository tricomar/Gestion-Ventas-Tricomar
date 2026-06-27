# Sistema de Migraciones de Base de Datos

## 📋 Descripción

Este sistema te permite mantener el esquema de tu base de datos MongoDB actualizado y detectar cuando se agregan nuevos campos o colecciones.

## 🚀 Uso

### Validar esquema actual
```bash
python /app/backend/migrations/schema_validator.py
```

### Aplicar todas las migraciones pendientes
```bash
python /app/backend/migrations/migrate.py
```

### Crear una nueva migración
```bash
python /app/backend/migrations/create_migration.py "nombre_descriptivo"
```

## 📁 Estructura

- `schema_validator.py` - Valida el esquema actual contra el esperado
- `migrate.py` - Aplica migraciones pendientes
- `create_migration.py` - Crea archivos de migración
- `schema_current.json` - Esquema actual de la base de datos
- `migrations/` - Carpeta con archivos de migración individuales

## 🔔 Notificaciones

El validador te notificará cuando:
- ✅ Nuevas colecciones sean detectadas
- ✅ Nuevos campos sean agregados a colecciones existentes
- ✅ Índices faltantes
- ⚠️ Campos requeridos faltantes en documentos existentes

## 📝 Convenciones

Cada archivo de migración debe:
1. Tener un nombre único con timestamp: `migration_YYYYMMDD_HHMMSS_descripcion.py`
2. Implementar función `up()` para aplicar cambios
3. Implementar función `down()` para revertir cambios (opcional)
4. Documentar los cambios en el docstring
