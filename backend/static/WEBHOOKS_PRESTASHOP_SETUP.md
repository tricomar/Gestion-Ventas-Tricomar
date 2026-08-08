# 🔔 Configuración de Webhooks PrestaShop para Negocio Feliz

## ¿Qué son los Webhooks?

Los webhooks permiten que PrestaShop notifique **instantáneamente** a Negocio Feliz cuando ocurre un evento importante (nueva orden, cambio de estado, actualización de producto, etc.), sin necesidad de estar consultando constantemente.

**Ventajas:**
- ✅ Sincronización **instantánea** (segundos vs minutos)
- ✅ Menor carga en los servidores
- ✅ Datos siempre actualizados en tiempo real

---

## 📋 Pre-requisitos

1. Acceso al panel de administración de PrestaShop
2. Permisos para instalar módulos
3. Tus integraciones de PrestaShop configuradas en Negocio Feliz

---

## 🔧 Método 1: Módulo Emergent Webhooks (Recomendado)

### Paso 1: Descargar el módulo

Desde Negocio Feliz:
1. Ve a **Configuración → Integraciones Ecommerce**
2. Busca tu integración de PrestaShop
3. Haz clic en **"Descargar Módulo de Webhooks"**
4. Guarda el archivo `emergent_webhooks.zip`

### Paso 2: Instalar en PrestaShop

1. Accede a tu panel de administración de PrestaShop
2. Ve a **Módulos → Module Manager** (Gestor de Módulos)
3. Haz clic en **"Upload a module"** (Subir un módulo)
4. Selecciona el archivo `emergent_webhooks.zip`
5. Haz clic en **"Install"** (Instalar)

### Paso 3: Configurar el módulo

1. Después de instalar, haz clic en **"Configure"** (Configurar)
2. Ingresa la URL del webhook:
   ```
   https://tu-dominio.emergent.com/api/integrations/webhooks/prestashop/{integration_id}
   ```
   
   **¿Dónde encontrar tu `integration_id`?**
   - Ve a Negocio Feliz → Configuración → Integraciones Ecommerce
   - Busca tu tienda PrestaShop
   - Copia el **ID de Integración** que aparece

3. Selecciona los eventos que deseas sincronizar:
   - ☑️ **Nueva Orden** (order_created)
   - ☑️ **Orden Actualizada** (order_updated)
   - ☑️ **Producto Actualizado** (product_updated)
   - ☑️ **Stock Actualizado** (stock_updated)
   - ☑️ **Cliente Creado** (customer_created)

4. Guarda la configuración

### Paso 4: Probar

1. Crea una orden de prueba en PrestaShop
2. Verifica en Negocio Feliz → Ecommerce que la orden aparezca en **segundos**
3. Si no aparece, revisa los logs del módulo en PrestaShop

---

## 🔧 Método 2: Webhooks Manuales (Avanzado)

Si prefieres configurar webhooks manualmente o tu versión de PrestaShop lo soporta nativamente:

### URLs de Webhook por Evento

Reemplaza `{integration_id}` con tu ID de integración real.

**Órdenes:**
```
POST https://tu-dominio.emergent.com/api/integrations/webhooks/prestashop/{integration_id}
Content-Type: application/json

{
  "event": "order_created",
  "resource": "order",
  "resource_id": "123",
  "timestamp": "2026-08-08T12:00:00Z",
  "data": {
    "order_id": "123",
    "total": "50.00",
    "state": "2"
  }
}
```

**Productos:**
```
POST https://tu-dominio.emergent.com/api/integrations/webhooks/prestashop/{integration_id}
Content-Type: application/json

{
  "event": "product_updated",
  "resource": "product",
  "resource_id": "456",
  "timestamp": "2026-08-08T12:00:00Z",
  "data": {
    "product_id": "456",
    "stock": "25"
  }
}
```

**Stock:**
```
POST https://tu-dominio.emergent.com/api/integrations/webhooks/prestashop/{integration_id}
Content-Type: application/json

{
  "event": "stock_updated",
  "resource": "stock",
  "resource_id": "789",
  "timestamp": "2026-08-08T12:00:00Z",
  "data": {
    "product_id": "789",
    "quantity": "15"
  }
}
```

---

## 📊 Eventos Soportados

| Evento | Descripción | Acción en Negocio Feliz |
|--------|-------------|-------------------------|
| `order_created` | Nueva orden creada | Sincroniza orden completa |
| `order_updated` | Orden actualizada (estado, pago, etc.) | Actualiza estado y datos |
| `product_created` | Nuevo producto | Sincroniza producto al inventario |
| `product_updated` | Producto actualizado (precio, nombre, etc.) | Actualiza datos del producto |
| `product_deleted` | Producto eliminado | Marca como inactivo |
| `stock_updated` | Stock modificado | Actualiza cantidad en inventario |
| `customer_created` | Nuevo cliente registrado | Agrega a clientes Ecommerce |
| `customer_updated` | Datos de cliente actualizados | Sincroniza cambios |

---

## 🧪 Verificación de Webhooks

### Desde PrestaShop (con módulo):
1. Ve a **Módulos → Emergent Webhooks**
2. En la sección "Test", haz clic en **"Enviar Webhook de Prueba"**
3. Verifica en Negocio Feliz que se recibió correctamente

### Desde Negocio Feliz:
1. Ve a **Configuración → Integraciones → PrestaShop**
2. Busca la sección **"Webhooks"**
3. Verás un log de webhooks recibidos con:
   - Evento
   - Fecha/Hora
   - Estado (procesado/error)
   - Detalles

### Logs del servidor:
```bash
# Ver últimos webhooks recibidos
tail -f /var/log/supervisor/backend.out.log | grep webhook
```

---

## ❌ Troubleshooting

### Problema: Webhooks no llegan

**Solución 1:** Verifica la URL
- Asegúrate de que la URL esté correcta
- Debe ser HTTPS (no HTTP)
- El `integration_id` debe ser correcto

**Solución 2:** Firewall de PrestaShop
- Algunos hostings bloquean conexiones salientes
- Contacta a tu proveedor para permitir webhooks a tu dominio

**Solución 3:** Logs de PrestaShop
- Revisa los logs del módulo en PrestaShop Admin
- Busca errores de conexión

### Problema: Webhook recibido pero no procesa

**Solución:**
- Ve a Negocio Feliz → Configuración → Integraciones
- Revisa el log de webhooks
- Busca el evento problemático y verifica el error
- Si aparece "integration not found", verifica el `integration_id`

### Problema: Datos desactualizados

**Solución:**
- Webhooks son instantáneos, pero el módulo debe estar activo
- Verifica que el módulo esté **instalado y activado**
- Prueba crear una orden y verifica si llega
- Si no llega, vuelve a configurar las URLs

---

## 🔐 Seguridad

### Validación de Webhooks

Los webhooks están protegidos por:
1. **Validación de integration_id:** Solo integraciones activas pueden recibir webhooks
2. **HTTPS:** Todas las comunicaciones son encriptadas
3. **Logs completos:** Todos los webhooks se registran para auditoría

### Mejores prácticas:
- ✅ Usa HTTPS siempre
- ✅ No compartas tu `integration_id` públicamente
- ✅ Revisa regularmente el log de webhooks
- ✅ Desactiva integraciones que ya no uses

---

## 📞 Soporte

Si tienes problemas configurando webhooks:

1. **Documentación:** Lee esta guía completa
2. **Logs:** Revisa logs tanto en PrestaShop como en Negocio Feliz
3. **Testing:** Usa el modo de prueba del módulo
4. **Fallback:** Mientras tanto, usa el botón "Sincronizar" manual (se sincroniza cada 30 segundos automáticamente)

---

## 🎯 Resumen

**Sin Webhooks (Polling cada 30s):**
- ⏱️ Orden creada → espera hasta 30s → aparece en Negocio Feliz

**Con Webhooks:**
- ⚡ Orden creada → 1-2 segundos → aparece en Negocio Feliz

**Recomendación:** Configura webhooks para sincronización instantánea. El polling de 30 segundos seguirá funcionando como respaldo.
