#!/bin/bash

################################################################################
# Script de Solución Rápida - Problemas Comunes
# Sistema de Gestión de Ventas
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="ventas-app"
BACKEND_PORT=8001

echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}   SOLUCIONES RÁPIDAS - Problemas Comunes${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""

# Función para verificar si es root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        echo -e "${RED}Este script debe ejecutarse como root (use sudo)${NC}"
        exit 1
    fi
}

# 1. Reiniciar todos los servicios
fix_restart_all() {
    echo -e "${YELLOW}Reiniciando todos los servicios...${NC}"
    systemctl restart mongod
    systemctl restart $APP_NAME-backend
    systemctl restart nginx
    sleep 3
    echo -e "${GREEN}✓ Servicios reiniciados${NC}"
    systemctl status mongod --no-pager | head -3
    systemctl status $APP_NAME-backend --no-pager | head -3
    systemctl status nginx --no-pager | head -3
}

# 2. Reparar permisos
fix_permissions() {
    echo -e "${YELLOW}Reparando permisos...${NC}"
    chown -R www-data:www-data /var/www/$APP_NAME
    chmod -R 755 /var/www/$APP_NAME
    echo -e "${GREEN}✓ Permisos reparados${NC}"
}

# 3. Reinstalar dependencias de Python
fix_python_deps() {
    echo -e "${YELLOW}Reinstalando dependencias de Python...${NC}"
    cd /var/www/$APP_NAME/backend
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt --force-reinstall
    deactivate
    echo -e "${GREEN}✓ Dependencias reinstaladas${NC}"
}

# 4. Verificar y reparar MongoDB
fix_mongodb() {
    echo -e "${YELLOW}Verificando MongoDB...${NC}"
    
    # Reiniciar MongoDB
    systemctl restart mongod
    sleep 2
    
    # Verificar conectividad
    if mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ MongoDB conectado${NC}"
    else
        echo -e "${RED}✗ MongoDB no responde${NC}"
        echo "Intentando reparar..."
        mongod --repair
        systemctl restart mongod
    fi
}

# 5. Recrear archivo .env del backend
fix_env_file() {
    echo -e "${YELLOW}Recreando archivo .env del backend...${NC}"
    cat > /var/www/$APP_NAME/backend/.env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=ventas_db
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=https://tricomar.store
EOF
    echo -e "${GREEN}✓ Archivo .env recreado${NC}"
    cat /var/www/$APP_NAME/backend/.env
}

# 6. Verificar configuración de Nginx para subpath
fix_nginx_config() {
    echo -e "${YELLOW}Verificando configuración de Nginx...${NC}"
    
    # Backup
    cp /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-available/$APP_NAME.backup
    
    # Recrear configuración
    cat > /etc/nginx/sites-available/$APP_NAME << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name tricomar.store;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tricomar.store;

    ssl_certificate /etc/letsencrypt/live/tricomar.store/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tricomar.store/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Aplicación en /appventas
    location /appventas {
        alias /var/www/ventas-app/frontend/build;
        try_files $uri $uri/ /appventas/index.html;
        index index.html;
    }

    # API Backend - IMPORTANTE: reescribir correctamente
    location /appventas/api/ {
        rewrite ^/appventas/api/(.*) /api/$1 break;
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    location / {
        root /var/www/html;
        index index.html;
    }

    access_log /var/log/nginx/ventas-app-access.log;
    error_log /var/log/nginx/ventas-app-error.log;
}
NGINXEOF

    # Verificar configuración
    if nginx -t; then
        echo -e "${GREEN}✓ Configuración de Nginx válida${NC}"
        systemctl reload nginx
        echo -e "${GREEN}✓ Nginx recargado${NC}"
    else
        echo -e "${RED}✗ Error en configuración de Nginx${NC}"
        echo "Restaurando backup..."
        mv /etc/nginx/sites-available/$APP_NAME.backup /etc/nginx/sites-available/$APP_NAME
    fi
}

# 7. Recrear usuario admin
fix_admin_user() {
    echo -e "${YELLOW}Recreando usuario administrador...${NC}"
    
    cd /var/www/$APP_NAME/backend
    source venv/bin/activate
    
    python3 << 'PYEOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

async def recreate_admin():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['ventas_db']
    
    # Eliminar si existe
    await db.users.delete_many({'email': 'admin@ventas.com'})
    
    # Crear nuevo admin
    password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.insert_one({
        'id': 'admin-001',
        'email': 'admin@ventas.com',
        'name': 'Administrador',
        'role': 'admin',
        'password_hash': password_hash,
        'created_at': '2024-01-01T00:00:00'
    })
    print("✓ Usuario admin recreado: admin@ventas.com / admin123")
    client.close()

asyncio.run(recreate_admin())
PYEOF
    
    deactivate
}

# Menú interactivo
show_menu() {
    echo ""
    echo "Selecciona una solución:"
    echo ""
    echo "  1) Reiniciar todos los servicios"
    echo "  2) Reparar permisos de archivos"
    echo "  3) Reinstalar dependencias de Python"
    echo "  4) Verificar y reparar MongoDB"
    echo "  5) Recrear archivo .env del backend"
    echo "  6) Reparar configuración de Nginx"
    echo "  7) Recrear usuario administrador"
    echo "  8) Aplicar TODAS las soluciones (recomendado)"
    echo "  9) Salir"
    echo ""
    read -p "Opción: " choice
    
    case $choice in
        1) fix_restart_all ;;
        2) fix_permissions ;;
        3) fix_python_deps ;;
        4) fix_mongodb ;;
        5) fix_env_file ;;
        6) fix_nginx_config ;;
        7) fix_admin_user ;;
        8)
            echo -e "${YELLOW}Aplicando todas las soluciones...${NC}"
            fix_permissions
            fix_env_file
            fix_mongodb
            fix_python_deps
            fix_nginx_config
            fix_admin_user
            fix_restart_all
            echo -e "${GREEN}✓ Todas las soluciones aplicadas${NC}"
            ;;
        9) exit 0 ;;
        *) echo -e "${RED}Opción inválida${NC}" ;;
    esac
    
    echo ""
    read -p "¿Aplicar otra solución? (s/n): " again
    if [[ $again =~ ^[Ss]$ ]]; then
        show_menu
    fi
}

# Verificar root
check_root

# Mostrar menú
show_menu
