# 🔄 Guía de Hard Reset de Base de Datos

## ⚠️ ADVERTENCIA IMPORTANTE

El **Hard Reset** es una operación **destructiva e irreversible** que borra **TODOS** los datos de la base de datos.

---

## 📋 ¿Qué hace el Hard Reset?

### Elimina:
- ✅ Todos los usuarios (excepto el nuevo administrador)
- ✅ Todos los productos del inventario
- ✅ Todas las ventas registradas
- ✅ Todos los gastos e ingresos
- ✅ Todos los clientes del CRM
- ✅ Todas las notas y registros del calendario
- ✅ Todas las configuraciones personalizadas

### Crea:
- ✅ Un nuevo usuario administrador con credenciales aleatorias
- ✅ Un documento de settings con valores por defecto
- ✅ Índices básicos en las colecciones

---

## 🚀 ¿Cuándo usar Hard Reset?

Usa esta función en los siguientes casos:

1. **Desarrollo/Testing**: Necesitas limpiar datos de prueba
2. **Demo/Presentación**: Quieres empezar con datos frescos
3. **Error Crítico**: Los datos están corruptos o inconsistentes
4. **Reinicio Completo**: Necesitas empezar desde cero

⚠️ **NO uses esta función en producción sin un backup completo**

---

## 📖 Cómo Usar

### Paso 1: Acceder a la Función

1. Inicia sesión como **Administrador**
2. Ve a **Menú** → **Configuración**
3. Click en la pestaña **"Base de Datos"**

### Paso 2: Ejecutar Hard Reset

1. Click en el botón rojo **"Ejecutar Hard Reset"**
2. Lee cuidadosamente las advertencias en el modal
3. Escribe exactamente `RESETEAR` en el campo de confirmación
4. Click en **"Confirmar Reset"**

### Paso 3: Guardar Credenciales

Después del reset, verás un modal con:

```
📧 EMAIL: admin@ventas.com
🔑 CONTRASEÑA: Admin[código-aleatorio]
```

**⚠️ IMPORTANTE**: 
- Copia estas credenciales INMEDIATAMENTE
- Usa el botón "Copiar Todo" para copiar ambas
- No podrás ver estas credenciales nuevamente
- Serás desconectado automáticamente en 10 segundos

### Paso 4: Iniciar Sesión Nuevamente

1. Usa las credenciales que copiaste
2. Email: `admin@ventas.com`
3. Contraseña: La que se generó aleatoriamente

---

## 🔐 Formato de Contraseña Generada

Las contraseñas generadas siguen el formato:
```
Admin[8-caracteres-hex]
```

Ejemplo: `Admin4f2a9b1c`

- **Longitud**: 13 caracteres
- **Formato**: Alfanumérico
- **Aleatoriedad**: UUID único por reset

---

## 🛡️ Seguridad

### Restricciones de Acceso:
- ✅ Solo usuarios con rol **"admin"** pueden ejecutar hard reset
- ✅ Requiere confirmación explícita escribiendo "RESETEAR"
- ✅ Genera credenciales únicas e impredecibles
- ✅ Las credenciales se muestran solo una vez

### Recomendaciones:
1. **Nunca** compartas las credenciales generadas por mensaje no cifrado
2. Cambia la contraseña inmediatamente después del primer login
3. Usa esta función solo cuando sea absolutamente necesario
4. Considera hacer un backup antes si hay datos importantes

---

## 🔧 Qué Pasa Técnicamente

### Backend (`/api/database/hard-reset`):

1. **Validación**: Verifica que el usuario es admin
2. **Eliminación**: Borra todas las colecciones de MongoDB
3. **Creación de Admin**: 
   - Email: `admin@ventas.com`
   - Password: Aleatorio con formato `Admin[uuid[:8]]`
   - Hash: bcrypt
4. **Settings**: Crea configuración por defecto
5. **Índices**: Recrea índices básicos en todas las colecciones
6. **Respuesta**: Devuelve credenciales en formato JSON

### Frontend (`SettingsPage.js`):

1. **Modal de Confirmación**: Requiere escribir "RESETEAR"
2. **Llamada API**: POST a `/api/database/hard-reset`
3. **Modal de Credenciales**: Muestra email y contraseña
4. **Copiar al Portapapeles**: Botones para copiar credenciales
5. **Auto-logout**: Desconecta al usuario tras 10 segundos
6. **Redirección**: Envía al login automáticamente

---

## 🐛 Troubleshooting

### Problema: "Solo administradores pueden hacer hard reset"
**Solución**: Necesitas iniciar sesión con una cuenta de rol "admin"

### Problema: "El botón Confirmar Reset está deshabilitado"
**Solución**: Asegúrate de escribir exactamente "RESETEAR" (en mayúsculas)

### Problema: "No puedo copiar las credenciales"
**Solución**: 
- Usa los botones "Copiar" individuales
- O usa "Copiar Todo" para copiar ambas credenciales
- Si no funcionan, escribe/fotografía las credenciales manualmente

### Problema: "Fui desconectado antes de copiar las credenciales"
**Solución**: 
- Las credenciales se pierden permanentemente
- Necesitas ejecutar otro hard reset
- Esta vez copia las credenciales inmediatamente

### Problema: "No puedo iniciar sesión con las nuevas credenciales"
**Solución**:
- Verifica que copiaste la contraseña correctamente (sin espacios extras)
- El email siempre es `admin@ventas.com`
- Si persiste el problema, ejecuta otro hard reset

---

## 📊 Estado Esperado Después del Reset

```
Colecciones:
  ✅ users: 1 documento (nuevo admin)
  ✅ settings: 1 documento (configuración por defecto)
  ✅ products: 0 documentos
  ✅ sales: 0 documentos
  ✅ expenses: 0 documentos
  ✅ customers: 0 documentos
  ✅ notes: 0 documentos
```

---

## 💡 Tips y Mejores Prácticas

### ✅ DO:
- Usa hard reset en ambientes de desarrollo/testing
- Copia las credenciales inmediatamente
- Cambia la contraseña después del primer login
- Documenta cuándo y por qué hiciste un reset
- Informa al equipo antes de hacer un reset

### ❌ DON'T:
- No uses hard reset en producción sin backup
- No cierres el modal sin copiar las credenciales
- No compartas las credenciales por canales inseguros
- No hagas hard reset sin informar al equipo
- No olvides guardar las credenciales

---

## 🔄 Alternativas al Hard Reset

Antes de hacer un hard reset completo, considera estas alternativas:

### 1. Eliminar Datos Específicos
- Borra solo usuarios, productos, ventas, etc. desde sus respectivas páginas
- Mantiene la estructura y configuración

### 2. Exportar/Importar
- Exporta datos importantes antes del reset
- Importa después si es necesario

### 3. Backup y Restore
- Haz backup de la base de datos MongoDB
- Restaura si algo sale mal

### 4. Nueva Base de Datos
- Crea una nueva instancia de base de datos
- Cambia la variable `DB_NAME` en `.env`

---

## 📞 Soporte

Si tienes problemas con el Hard Reset:

1. Revisa esta guía completamente
2. Verifica los logs del backend: `/var/log/supervisor/backend.*.log`
3. Verifica el estado de MongoDB
4. Consulta la documentación técnica en el código

---

## ⚙️ Configuración Técnica

### Variables de Entorno:
```bash
# Backend
MONGO_URL=mongodb://...
DB_NAME=sales_management
JWT_SECRET=your-secret-key
```

### Archivos Modificados:
- Backend: `/app/backend/server.py` (endpoint `/api/database/hard-reset`)
- Frontend: `/app/frontend/src/pages/SettingsPage.js` (UI del hard reset)

---

**Última actualización**: 2026-07-13  
**Versión**: 1.0.0
