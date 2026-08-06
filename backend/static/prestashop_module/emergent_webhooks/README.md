# Emergent Webhooks - Módulo para PrestaShop

## 📦 Instalación

1. Descarga el archivo `emergent_webhooks.zip`
2. En tu panel de PrestaShop, ve a **Módulos** > **Gestor de módulos**
3. Haz clic en **Subir un módulo**
4. Selecciona el archivo ZIP descargado
5. Haz clic en **Instalar**

## ⚙️ Configuración

1. Una vez instalado, haz clic en **Configurar**
2. Copia la URL de webhook desde tu panel de Negocio Feliz:
   - Ve a **Configuración** > **Integraciones** > **PrestaShop**
   - Copia la URL que aparece (ejemplo: `https://tu-dominio.com/api/integrations/webhooks/prestashop/abc123...`)
3. Pega la URL en el campo **URL de Webhook**
4. Asegúrate de que **Activar Webhooks** esté en **Activado**
5. Haz clic en **Guardar**

## ✅ Eventos Sincronizados

El módulo enviará notificaciones automáticamente cuando:

- ✅ Se crea un producto
- ✅ Se actualiza un producto
- ✅ Se elimina un producto
- ✅ Se crea una orden/pedido
- ✅ Se actualiza el estado de una orden
- ✅ Se crea un cliente
- ✅ Se actualiza un cliente
- ✅ Se actualiza el stock de un producto

## 🔧 Requisitos

- PrestaShop 1.6 o superior
- PHP 7.0 o superior
- Extensión PHP cURL habilitada

## 📝 Soporte

Para soporte o preguntas:
- Email: support@emergentlabs.com
- Documentación: https://docs.emergentlabs.com

## 🔐 Seguridad

Este módulo envía datos a través de HTTPS. Asegúrate de que tu dominio de Negocio Feliz tenga certificado SSL válido.

## 📄 Licencia

Copyright © 2026 Emergent Labs. Todos los derechos reservados.
