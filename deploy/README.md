# 🚀 Guía de Despliegue - Sistema de Gestión de Ventas

## 📋 Requisitos Previos

- **Servidor**: VPS con Ubuntu 24.04
- **Dominio**: tricomar.store apuntando a la IP del servidor
- **Acceso**: SSH con privilegios root/sudo
- **RAM**: Mínimo 2GB
- **Disco**: Mínimo 20GB

---

## 🔧 Instalación Paso a Paso

### 1️⃣ Preparar el Servidor

```bash
# Conectarse al servidor via SSH
ssh root@tu-servidor-ip

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Crear directorio temporal
mkdir -p /tmp/deploy && cd /tmp/deploy
```

### 2️⃣ Subir Archivos al Servidor

**Opción A: Desde tu máquina local**
```bash
# Comprimir el proyecto
cd /app
tar -czf ventas-app.tar.gz backend/ frontend/ deploy/

# Subir al servidor
scp ventas-app.tar.gz root@tu-servidor-ip:/tmp/deploy/

# En el servidor, descomprimir
cd /tmp/deploy
tar -xzf ventas-app.tar.gz
```

**Opción B: Usando Git (si tienes repositorio)**
```bash
cd /tmp/deploy
git clone tu-repositorio-url
cd tu-repositorio
```

### 3️⃣ Ejecutar Script de Instalación

```bash
cd /tmp/deploy
sudo bash deploy/install.sh
```

El script instalará:
- ✅ Node.js 20.x y Yarn
- ✅ Python 3.11
- ✅ MongoDB 7.0
- ✅ Nginx
- ✅ Backend FastAPI (systemd service)
- ✅ Frontend React (build)

**⏱️ Tiempo estimado: 10-15 minutos**

### 4️⃣ Configurar DNS

Antes de continuar, asegúrate de que tu dominio apunte al servidor:

```bash
# Verificar IP del servidor
curl ifconfig.me

# Verificar que el DNS apunta correctamente
dig +short tricomar.store
```

**Configuración en tu proveedor de DNS:**
```
Tipo: A
Nombre: @ (o vacío)
Valor: [IP-de-tu-servidor]
TTL: 3600
```

### 5️⃣ Instalar Certificado SSL

```bash
cd /var/www/ventas-app
sudo bash deploy/setup-ssl.sh
```

Esto configurará:
- ✅ Certificado SSL gratuito (Let's Encrypt)
- ✅ HTTPS automático
- ✅ Renovación automática de certificado
- ✅ Redirección HTTP → HTTPS

---

## 🔍 Diagnóstico de Problemas

### ❌ "Error al registrar usuario"

**Paso 1: Ejecutar diagnóstico completo**
```bash
cd /var/www/ventas-app
sudo bash deploy/diagnostic.sh
```

Este script verificará:
- Estado de servicios (MongoDB, Backend, Nginx)
- Conectividad de puertos
- Logs de errores
- Pruebas de endpoints
- Configuración CORS
- Variables de entorno

**Paso 2: Aplicar soluciones automáticas**
```bash
cd /var/www/ventas-app
sudo bash deploy/fix-common-issues.sh
```

Opciones disponibles:
1. Reiniciar todos los servicios
2. Reparar permisos de archivos
3. Reinstalar dependencias de Python
4. Verificar y reparar MongoDB
5. Recrear archivo .env del backend
6. Reparar configuración de Nginx
7. Recrear usuario administrador
8. **Aplicar TODAS las soluciones (recomendado si persiste el error)**

---

## 📊 Comandos Útiles

### Ver Estado de Servicios
```bash
# Backend
sudo systemctl status ventas-app-backend

# MongoDB
sudo systemctl status mongod

# Nginx
sudo systemctl status nginx
```

### Ver Logs en Tiempo Real
```bash
# Backend (más útil para errores)
sudo journalctl -u ventas-app-backend -f

# Nginx
sudo tail -f /var/log/nginx/ventas-app-error.log
```

### Reiniciar Servicios
```bash
# Backend
sudo systemctl restart ventas-app-backend

# Todos
sudo systemctl restart mongod ventas-app-backend nginx
```

### Probar Endpoints Manualmente
```bash
# Test de registro
curl -X POST https://tricomar.store/appventas/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123",
    "name": "Test Usuario",
    "role": "operator"
  }'

# Test de login
curl -X POST https://tricomar.store/appventas/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ventas.com",
    "password": "admin123"
  }'
```

---

## 🔐 Credenciales por Defecto

**Usuario Administrador:**
- Email: `admin@ventas.com`
- Password: `admin123`

⚠️ **IMPORTANTE**: Cambia la contraseña después del primer login.

---

## 🌐 Acceso a la Aplicación

Una vez instalado correctamente:

**URL:** https://tricomar.store/appventas

---

## 🐛 Problemas Comunes y Soluciones

### 1. "502 Bad Gateway"
**Causa:** Backend no está corriendo
```bash
sudo systemctl start ventas-app-backend
sudo systemctl status ventas-app-backend
```

### 2. "500 Internal Server Error"
**Causa:** Error en el código del backend
```bash
# Ver logs detallados
sudo journalctl -u ventas-app-backend -n 50 --no-pager
```

### 3. "Connection refused"
**Causa:** MongoDB no está activo
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

### 4. "CORS Error" en el navegador
**Causa:** Configuración CORS incorrecta
```bash
# Verificar archivo .env
cat /var/www/ventas-app/backend/.env

# Debe contener:
# CORS_ORIGINS=https://tricomar.store
```

### 5. Frontend muestra página en blanco
**Causa:** Build incorrecto o ruta mal configurada
```bash
# Reconstruir frontend
cd /var/www/ventas-app/frontend
yarn build

# Verificar configuración de Nginx
sudo nginx -t
```

---

## 📁 Estructura de Archivos en el Servidor

```
/var/www/ventas-app/
├── backend/
│   ├── venv/                    # Entorno virtual Python
│   ├── server.py               # Backend FastAPI
│   ├── requirements.txt
│   └── .env                    # Variables de entorno
├── frontend/
│   ├── build/                  # Build de React (servido por Nginx)
│   ├── src/
│   └── package.json
└── deploy/
    ├── install.sh              # Script de instalación
    ├── setup-ssl.sh            # Configuración SSL
    ├── diagnostic.sh           # Diagnóstico
    └── fix-common-issues.sh    # Soluciones rápidas

/etc/nginx/sites-available/
└── ventas-app                  # Configuración de Nginx

/etc/systemd/system/
└── ventas-app-backend.service  # Servicio del backend

/var/log/nginx/
├── ventas-app-access.log       # Logs de acceso
└── ventas-app-error.log        # Logs de errores
```

---

## 🔄 Actualización de la Aplicación

```bash
# 1. Hacer backup
sudo cp -r /var/www/ventas-app /var/www/ventas-app.backup

# 2. Subir nueva versión del código
# (usar scp o git pull)

# 3. Actualizar backend
cd /var/www/ventas-app/backend
source venv/bin/activate
pip install -r requirements.txt --upgrade
deactivate

# 4. Reconstruir frontend
cd /var/www/ventas-app/frontend
yarn install
yarn build

# 5. Reiniciar servicios
sudo systemctl restart ventas-app-backend
sudo systemctl reload nginx
```

---

## 📞 Soporte

Si después de seguir todos los pasos el problema persiste:

1. Ejecuta el diagnóstico completo y guarda la salida:
```bash
sudo bash /var/www/ventas-app/deploy/diagnostic.sh > diagnostico.txt
```

2. Revisa los logs completos del backend:
```bash
sudo journalctl -u ventas-app-backend -n 100 --no-pager > logs-backend.txt
```

3. Comparte ambos archivos para análisis detallado.

---

## ✅ Checklist de Verificación Post-Instalación

- [ ] Todos los servicios están corriendo (`systemctl status`)
- [ ] MongoDB acepta conexiones (`mongosh --eval "db.adminCommand('ping')"`)
- [ ] Backend responde (`curl http://localhost:8001/api/auth/me`)
- [ ] Nginx sirve la aplicación (`curl https://tricomar.store/appventas`)
- [ ] SSL está activo (candado verde en el navegador)
- [ ] Puedes hacer login con admin@ventas.com / admin123
- [ ] Puedes registrar nuevos usuarios

---

**¡Listo! Tu sistema está desplegado y funcionando. 🎉**
