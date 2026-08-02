# Sistema de Gestión de Sesiones

## Descripción

El sistema ahora detecta automáticamente cuando una sesión de usuario expira (error 401 del backend) y muestra un modal de re-autenticación para que el usuario pueda continuar trabajando sin perder su progreso.

## Componentes Implementados

### 1. SessionExpiredModal.js
Modal que aparece cuando la sesión expira, permite al usuario:
- Volver a iniciar sesión sin perder su trabajo actual
- Cerrar sesión voluntariamente

### 2. axiosInterceptor.js
Interceptor de Axios que:
- Detecta errores 401 (no autorizado)
- Dispara automáticamente el modal de sesión expirada
- Solo se activa si había un token válido (usuario autenticado)

### 3. AuthContext actualizado
Nuevo estado y funciones:
- `showSessionExpired`: Estado del modal
- `handleSessionExpired()`: Muestra el modal
- `reauthenticate()`: Re-autentica al usuario sin perder estado
- `sessionExpiredReason`: Diferencia entre cierre voluntario y expiración

### 4. App.js actualizado
- Integra el modal en la aplicación
- Configura el interceptor de Axios al iniciar
- Maneja la navegación después del logout

## Flujo de Funcionamiento

### Sesión Expirada Durante Uso
1. Usuario está trabajando en la aplicación
2. Token JWT expira en el backend
3. Usuario intenta hacer una acción (ej: registrar venta)
4. Backend responde con error 401
5. Interceptor detecta el 401
6. Se muestra modal "Sesión Expirada"
7. Usuario ingresa credenciales
8. Sistema re-autentica y actualiza token
9. Usuario continúa donde lo dejó

### Cierre de Sesión Voluntario
1. Usuario hace clic en "Cerrar Sesión"
2. Sistema llama `logout('manual')`
3. Se limpia localStorage y estado
4. Redirige a página de login
5. NO muestra modal de sesión expirada

## Beneficios

✅ **Sin Pérdida de Trabajo**: El usuario puede re-autenticarse sin perder formularios o trabajo actual
✅ **Experiencia Mejorada**: No necesita volver a navegar a donde estaba
✅ **Seguridad**: Mantiene la expiración de tokens del backend
✅ **Claridad**: Mensaje claro de por qué se solicita login nuevamente
