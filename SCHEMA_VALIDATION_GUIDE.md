# 🔍 Sistema de Validación y Corrección de Esquema de Base de Datos

## 📋 Descripción

Sistema automático que valida la estructura de la base de datos MongoDB y corrige automáticamente cualquier inconsistencia, creando colecciones, índices o campos faltantes sin eliminar datos existentes.

---

## ✨ Funcionalidades

### ✅ Operaciones Seguras

El sistema realiza las siguientes operaciones **sin eliminar datos**:

1. **Detecta colecciones faltantes** y las crea automáticamente
2. **Crea índices necesarios** para optimización de consultas
3. **Inicializa documento de settings** si no existe
4. **Genera reporte detallado** de todos los cambios realizados

### 🔒 Seguridad

- ✅ **NO elimina datos existentes**
- ✅ **NO modifica documentos actuales**
- ✅ **Solo accesible para administradores**
- ✅ **Operación idempotente** (se puede ejecutar múltiples veces sin problema)

---

## 🎯 ¿Cuándo Usar?

Usa esta función en los siguientes casos:

### Casos de Uso Comunes:

1. **Después de actualizar el código**: Nuevas funcionalidades pueden requerir nuevas colecciones o índices
2. **Al migrar a un nuevo servidor**: Asegurar que el esquema está completo
3. **Errores de "colección no encontrada"**: Crear automáticamente colecciones faltantes
4. **Optimización**: Crear índices para mejorar el rendimiento
5. **Mantenimiento preventivo**: Verificar periódicamente la integridad del esquema

---

## 📖 Cómo Usar

### Desde el Frontend

1. **Iniciar sesión** como administrador
2. **Navegar** a Menú → Configuración
3. **Click** en la pestaña "Base de Datos"
4. **Localizar** la sección azul "🔍 Validar y Corregir Esquema"
5. **Click** en el botón "Validar y Corregir Esquema"
6. **Esperar** a que se complete la validación (2-5 segundos)
7. **Revisar** el reporte detallado en el modal

### Desde la API (Opcional)

```bash
curl -X POST "https://tu-api.com/api/database/validate-and-fix" \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📊 Esquema Validado

El sistema verifica y crea las siguientes colecciones e índices:

### 🗂️ Colecciones

| Colección | Propósito | Índices |
|-----------|-----------|---------|
| `users` | Usuarios del sistema | email (unique), id (unique) |
| `products` | Inventario de productos | id (unique), name, store |
| `sales` | Registro de ventas | id (unique), product_id, customer_id, date, store |
| `expenses` | Gastos del negocio | id (unique), date, category |
| `other_income` | Otros ingresos | id (unique), date |
| `customers` | Clientes CRM | id (unique), name, store |
| `notes` | Notas y calendario | id (unique), date, author_id, status |
| `note_reads` | Lecturas de notas | note_id, user_id |
| `settings` | Configuración global | id (unique) |

**Total: 9 colecciones**

---

## 📝 Reporte de Validación

### Estructura del Reporte

```json
{
  "status": "fixed",  // "ok" o "fixed"
  "message": "Se realizaron X correcciones en el esquema",
  "collections_checked": 9,
  "collections_created": ["other_income", "note_reads"],
  "indexes_created": [
    {
      "collection": "products",
      "field": "name",
      "unique": false
    }
  ],
  "settings_initialized": true,
  "errors": [],
  "warnings": [],
  "timestamp": "2026-07-13T23:12:57.123456+00:00"
}
```

### Estados Posibles

| Estado | Descripción | Color |
|--------|-------------|-------|
| **ok** | Todo correcto, sin cambios necesarios | 🟢 Verde |
| **fixed** | Se realizaron correcciones | 🔵 Azul |
| **error** | Hubo errores durante la validación | 🔴 Rojo |

---

## 🔧 Detalles Técnicos

### Backend

**Archivo**: `/app/backend/routes/database.py`  
**Endpoint**: `POST /api/database/validate-and-fix`  
**Autenticación**: Requiere JWT token de admin

**Esquema de validación**:
```python
EXPECTED_SCHEMA = {
    'users': {
        'indexes': [
            {'key': 'email', 'unique': True},
            {'key': 'id', 'unique': True}
        ],
        'required_fields': ['id', 'email', 'password_hash', ...]
    },
    # ... más colecciones
}
```

### Frontend

**Archivo**: `/app/frontend/src/pages/SettingsPage.js`  
**Componente**: `SettingsPage` → Tab "Base de Datos"  
**Función**: `handleValidateSchema()`

---

## 🎨 Interfaz de Usuario

### Sección de Validación

```
┌─────────────────────────────────────────────┐
│ 🔍 Validar y Corregir Esquema              │
│                                             │
│ Verifica la estructura de la base de datos  │
│ y crea automáticamente tablas, índices o    │
│ campos faltantes. Esta operación es segura  │
│ y no elimina datos existentes.              │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Esta acción:                         │   │
│ │ ✅ Detecta colecciones faltantes     │   │
│ │ ✅ Crea índices necesarios           │   │
│ │ ✅ Inicializa configuración          │   │
│ │ ✅ NO elimina datos existentes       │   │
│ │ ✅ Genera reporte detallado          │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ [Validar y Corregir Esquema]               │
└─────────────────────────────────────────────┘
```

### Modal de Resultados

```
┌──────────────────────────────────────────┐
│ ✅ Esquema Validado                   [X]│
├──────────────────────────────────────────┤
│                                          │
│ ✅ El esquema de la base de datos está  │
│    correcto. No se requieren cambios.   │
│                                          │
│ Timestamp: 13/7/2026, 23:12:57          │
│                                          │
├──────────────────────────────────────────┤
│ Colecciones verificadas: 9               │
│ Cambios realizados: 0                    │
├──────────────────────────────────────────┤
│                                          │
│                 [Cerrar]                 │
└──────────────────────────────────────────┘
```

---

## 🔄 Flujo de Validación

```
1. Usuario → Click "Validar y Corregir Esquema"
         ↓
2. Frontend → POST /api/database/validate-and-fix
         ↓
3. Backend → Obtiene lista de colecciones existentes
         ↓
4. Backend → Para cada colección esperada:
         ├→ ¿Existe? No → Crear colección
         └→ ¿Índices? Faltan → Crear índices
         ↓
5. Backend → Verifica documento settings
         └→ ¿Existe? No → Inicializar
         ↓
6. Backend → Genera reporte detallado
         ↓
7. Frontend → Muestra modal con resultados
```

---

## ⚠️ Casos Especiales

### Índices Únicos Duplicados

Si intentas crear un índice único pero hay valores duplicados:
```json
{
  "errors": [{
    "collection": "users",
    "index": "email",
    "error": "duplicate key error"
  }]
}
```

**Solución**: Limpia los datos duplicados manualmente antes de crear el índice.

### Colecciones con Datos Legacy

El sistema **NO modifica** documentos existentes. Si una colección tiene campos antiguos que ya no se usan, permanecerán intactos.

---

## 💡 Mejores Prácticas

### ✅ Recomendaciones

1. **Ejecuta después de cada actualización** del código que modifique el esquema
2. **Documenta cambios** en el esquema cuando agregues nuevas funcionalidades
3. **Revisa el reporte** para entender qué se modificó
4. **Ejecuta en desarrollo primero** antes de aplicar en producción
5. **Mantén backups** regulares (aunque esta operación es segura)

### 🔍 Verificación Post-Validación

Después de ejecutar la validación, verifica que:

- ✅ Todas las colecciones aparecen listadas
- ✅ Los índices se crearon correctamente
- ✅ No hay errores en el reporte
- ✅ La aplicación funciona normalmente

---

## 🐛 Troubleshooting

### Problema: "Not authenticated"
**Causa**: No estás logueado o el token expiró  
**Solución**: Vuelve a iniciar sesión como administrador

### Problema: "Solo administradores pueden realizar esta acción"
**Causa**: Tu usuario no tiene rol de admin  
**Solución**: Pide a un admin que te otorgue permisos

### Problema: Índices no se crean
**Causa**: Puede haber datos duplicados para índices únicos  
**Solución**: Revisa el campo `errors` en el reporte

### Problema: La validación tarda mucho
**Causa**: Base de datos grande o conexión lenta  
**Solución**: Normal en BDs grandes (>100k documentos). Espera pacientemente.

---

## 📚 Archivos Relacionados

### Backend
- `/app/backend/routes/database.py` - Endpoint de validación
- `/app/backend/migrations/schema_validator.py` - Sistema de migraciones

### Frontend
- `/app/frontend/src/pages/SettingsPage.js` - UI de validación

### Documentación
- `/app/DATABASE_SYSTEM.md` - Sistema completo de migraciones
- `/app/HARD_RESET_GUIDE.md` - Guía de hard reset

---

## 🔄 Diferencias con Hard Reset

| Característica | Validar Esquema | Hard Reset |
|----------------|-----------------|------------|
| **Elimina datos** | ❌ NO | ✅ SÍ (TODO) |
| **Crea colecciones** | ✅ Faltantes | ✅ Todas |
| **Crea índices** | ✅ Faltantes | ✅ Todos |
| **Seguridad** | 🟢 Muy segura | 🔴 Destructiva |
| **Uso** | 🔄 Mantenimiento | 🚨 Emergencia |
| **Revertible** | N/A (sin cambios) | ❌ NO |

---

## 🎓 Ejemplo de Uso

### Escenario: Actualización de Código

**Situación**: Agregaste una nueva funcionalidad "Proveedores" que requiere una nueva colección.

**Pasos**:

1. Subes el código actualizado al servidor
2. El código incluye modelos y rutas para `suppliers`
3. Al intentar usar la funcionalidad, obtienes error "Collection not found"
4. Vas a Configuración → Base de Datos
5. Click en "Validar y Corregir Esquema"
6. El sistema detecta y crea:
   - Colección `suppliers`
   - Índices: `id` (unique), `name`, `category`
7. Modal muestra: "✅ Se realizaron 4 correcciones"
8. Ahora la funcionalidad funciona perfectamente

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa el reporte de validación
2. Verifica los logs del backend
3. Consulta esta documentación
4. Reporta el error con el reporte completo

---

**Última actualización**: 2026-07-13  
**Versión**: 1.0.0
