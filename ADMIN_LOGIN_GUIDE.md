# Guía de Login del Super Administrador

## 🔑 Login Simplificado para Admin

El **super administrador** tiene un acceso simplificado al sistema.

### Credenciales de Login

- **Usuario**: `admin` (sin @ventas.com)
- **Contraseña**: La generada automáticamente después del Hard Reset

### ¿Cómo funciona?

1. **Super Administrador**:
   - Puede iniciar sesión usando solo `admin` en el campo de usuario
   - El sistema automáticamente lo busca como `admin@ventas.com` en la base de datos

2. **Usuarios Normales**:
   - **DEBEN** usar su email completo (ej: `usuario@empresa.com`)
   - No pueden usar shortcuts como el admin

---

## 🔄 Hard Reset del Sistema

### ¿Qué hace el Hard Reset?

El Hard Reset borra **TODA** la base de datos y crea un nuevo super administrador con credenciales aleatorias.

### ¿Cómo acceder a las credenciales después del Hard Reset?

Después de ejecutar un Hard Reset, las credenciales se guardan en:

**📁 Archivo**: `/app/ADMIN_CREDENTIALS.txt`

Este archivo contiene:
- Usuario para login (siempre `admin`)
- Contraseña generada aleatoriamente
- Fecha y hora del reset
- Instrucciones de uso

### ⚠️ IMPORTANTE

- **Guarda las credenciales** en un lugar seguro inmediatamente
- **Elimina el archivo** `/app/ADMIN_CREDENTIALS.txt` después de copiar la información
- La contraseña es **aleatoria** y **única** cada vez que ejecutas un Hard Reset

---

## 🎯 Ejemplo de Uso

### Login con Admin:
```
Usuario: admin
Contraseña: [La del archivo ADMIN_CREDENTIALS.txt]
```

### Login con Usuario Normal:
```
Usuario: juan@miempresa.com
Contraseña: [Su contraseña]
```

---

## 🔐 Seguridad

- Solo el super administrador puede usar el shortcut `admin`
- Todos los demás usuarios **requieren email completo**
- Las contraseñas se hashean con bcrypt
- Los tokens JWT expiran después de 7 días
