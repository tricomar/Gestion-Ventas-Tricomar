#!/bin/bash

################################################################################
# Script de Instalación - Sistema de Gestión de Ventas
# Dominio: https://tricomar.store/appventas
# Sistema: Ubuntu 24.04
# Servidor Web: Nginx
################################################################################

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuración
DOMAIN="tricomar.store"
APP_PATH="/appventas"
APP_NAME="ventas-app"
INSTALL_DIR="/var/www/$APP_NAME"
BACKEND_PORT=8001
DB_NAME="ventas_db"
ADMIN_EMAIL="admin@tricomar.store"  # Para certificado SSL

# Función para imprimir mensajes
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then 
    print_error "Este script debe ejecutarse como root (use sudo)"
    exit 1
fi

print_message "==================================================================="
print_message "Iniciando instalación del Sistema de Gestión de Ventas"
print_message "Dominio: https://$DOMAIN$APP_PATH"
print_message "==================================================================="
echo ""

# 1. Actualizar sistema
print_message "Paso 1/10: Actualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependencias básicas
print_message "Paso 2/10: Instalando dependencias básicas..."
apt install -y curl wget git gnupg2 software-properties-common apt-transport-https ca-certificates

# 3. Instalar Node.js 20.x
print_message "Paso 3/10: Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar Yarn
npm install -g yarn

print_message "Node.js version: $(node --version)"
print_message "Yarn version: $(yarn --version)"

# 4. Instalar Python 3.11
print_message "Paso 4/10: Instalando Python 3.11 y pip..."
apt install -y python3 python3-pip python3-venv
print_message "Python version: $(python3 --version)"

# 5. Instalar MongoDB
print_message "Paso 5/10: Instalando MongoDB 7.0..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org

# Iniciar y habilitar MongoDB
systemctl start mongod
systemctl enable mongod
print_message "MongoDB instalado y en ejecución"

# 6. Instalar Nginx
print_message "Paso 6/10: Instalando Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx
print_message "Nginx instalado y en ejecución"

# 7. Crear directorio de instalación
print_message "Paso 7/10: Configurando directorio de aplicación..."
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

print_warning "IMPORTANTE: Ahora debes copiar tu código al servidor."
print_warning "Ejecuta desde tu máquina local:"
echo ""
echo "  scp -r /app/* root@tu-servidor-ip:$INSTALL_DIR/"
echo ""
read -p "¿Has copiado el código? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    print_error "Copia el código y vuelve a ejecutar el script"
    exit 1
fi

# 8. Configurar Backend
print_message "Paso 8/10: Configurando Backend (FastAPI)..."

# Crear entorno virtual
cd $INSTALL_DIR/backend
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# Crear archivo .env de producción
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=$DB_NAME
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=https://$DOMAIN
EOF

print_message "Backend configurado correctamente"

# Crear usuario administrador inicial
print_message "Creando usuario administrador..."
python3 << PYEOF
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

async def create_admin():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['$DB_NAME']
    
    # Verificar si ya existe
    existing = await db.users.find_one({'email': 'admin@ventas.com'})
    if existing:
        print("Usuario admin ya existe")
        return
    
    # Crear admin
    password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.insert_one({
        'id': 'admin-001',
        'email': 'admin@ventas.com',
        'name': 'Administrador',
        'role': 'admin',
        'password_hash': password_hash,
        'created_at': '2024-01-01T00:00:00'
    })
    print("✓ Usuario admin creado: admin@ventas.com / admin123")
    client.close()

asyncio.run(create_admin())
PYEOF

deactivate

# Crear servicio systemd para el backend
cat > /etc/systemd/system/$APP_NAME-backend.service << EOF
[Unit]
Description=Sistema de Ventas - Backend FastAPI
After=network.target mongod.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin"
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Ajustar permisos
chown -R www-data:www-data $INSTALL_DIR/backend

# Iniciar backend
systemctl daemon-reload
systemctl start $APP_NAME-backend
systemctl enable $APP_NAME-backend
print_message "Backend iniciado como servicio systemd"

# 9. Configurar Frontend
print_message "Paso 9/10: Configurando Frontend (React)..."
cd $INSTALL_DIR/frontend

# Crear .env de producción
cat > .env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN$APP_PATH
EOF

# Instalar dependencias y construir
yarn install
yarn build

print_message "Frontend construido exitosamente"

# 10. Configurar Nginx
print_message "Paso 10/10: Configurando Nginx..."

# Crear configuración de Nginx
cat > /etc/nginx/sites-available/$APP_NAME << 'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    # Redirect HTTP to HTTPS (se habilitará después de SSL)
    # return 301 https://$server_name$request_uri;

    # Configuración temporal para verificación de dominio
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    # Aplicación en subpath
    location APP_PATH_PLACEHOLDER {
        alias /var/www/APP_NAME_PLACEHOLDER/frontend/build;
        try_files $uri $uri/ /index.html;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # API Backend
    location APP_PATH_PLACEHOLDER/api {
        rewrite ^APP_PATH_PLACEHOLDER/api/(.*) /api/$1 break;
        proxy_pass http://localhost:BACKEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Logs
    access_log /var/log/nginx/APP_NAME_PLACEHOLDER-access.log;
    error_log /var/log/nginx/APP_NAME_PLACEHOLDER-error.log;
}
NGINXCONF

# Reemplazar placeholders
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" /etc/nginx/sites-available/$APP_NAME
sed -i "s|APP_PATH_PLACEHOLDER|$APP_PATH|g" /etc/nginx/sites-available/$APP_NAME
sed -i "s|APP_NAME_PLACEHOLDER|$APP_NAME|g" /etc/nginx/sites-available/$APP_NAME
sed -i "s|BACKEND_PORT_PLACEHOLDER|$BACKEND_PORT|g" /etc/nginx/sites-available/$APP_NAME

# Habilitar sitio
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t

# Recargar Nginx
systemctl reload nginx

print_message "Nginx configurado correctamente"

echo ""
print_message "==================================================================="
print_message "✓ Instalación completada exitosamente!"
print_message "==================================================================="
echo ""
print_message "Detalles de la instalación:"
echo "  - Aplicación: http://$DOMAIN$APP_PATH (HTTP por ahora)"
echo "  - Backend: Puerto $BACKEND_PORT (interno)"
echo "  - MongoDB: localhost:27017"
echo "  - Usuario admin: admin@ventas.com / admin123"
echo ""
print_warning "PRÓXIMOS PASOS IMPORTANTES:"
echo ""
echo "1. CONFIGURAR DNS:"
echo "   Asegúrate de que $DOMAIN apunta a la IP de este servidor"
echo "   Tipo A: $DOMAIN -> $(curl -s ifconfig.me)"
echo ""
echo "2. INSTALAR CERTIFICADO SSL (HTTPS):"
echo "   Ejecuta:"
echo "   sudo bash $INSTALL_DIR/deploy/setup-ssl.sh"
echo ""
echo "3. VERIFICAR SERVICIOS:"
echo "   sudo systemctl status $APP_NAME-backend"
echo "   sudo systemctl status nginx"
echo "   sudo systemctl status mongod"
echo ""
echo "4. VER LOGS:"
echo "   Backend: sudo journalctl -u $APP_NAME-backend -f"
echo "   Nginx: sudo tail -f /var/log/nginx/$APP_NAME-error.log"
echo ""
print_message "¡Disfruta tu aplicación!"
