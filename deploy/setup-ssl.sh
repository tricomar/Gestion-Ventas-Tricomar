#!/bin/bash

################################################################################
# Script de Configuración SSL - Sistema de Gestión de Ventas
# Configura HTTPS con Let's Encrypt
################################################################################

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar root
if [ "$EUID" -ne 0 ]; then 
    print_error "Este script debe ejecutarse como root (use sudo)"
    exit 1
fi

# Variables
DOMAIN="tricomar.store"
APP_NAME="ventas-app"
ADMIN_EMAIL="admin@tricomar.store"

print_message "==================================================================="
print_message "Configurando SSL para https://$DOMAIN"
print_message "==================================================================="
echo ""

# Verificar que el dominio apunte al servidor
print_message "Verificando DNS..."
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    print_error "El dominio $DOMAIN no apunta a este servidor"
    print_error "IP del servidor: $SERVER_IP"
    print_error "IP del dominio: $DOMAIN_IP"
    print_error "Configura tu DNS antes de continuar"
    exit 1
fi

print_message "✓ DNS configurado correctamente"

# Instalar Certbot
print_message "Instalando Certbot..."
apt update
apt install -y certbot python3-certbot-nginx

# Obtener certificado
print_message "Obteniendo certificado SSL..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect

# Actualizar configuración de Nginx para el subpath con SSL
print_message "Actualizando configuración de Nginx para HTTPS..."

cat > /etc/nginx/sites-available/$APP_NAME << 'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name tricomar.store;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tricomar.store;

    # Certificados SSL (Certbot los gestiona automáticamente)
    ssl_certificate /etc/letsencrypt/live/tricomar.store/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tricomar.store/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Aplicación en subpath /appventas
    location /appventas {
        alias /var/www/ventas-app/frontend/build;
        try_files $uri $uri/ /appventas/index.html;
        index index.html;

        # Configuración de caché para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend
    location /appventas/api {
        rewrite ^/appventas/api/(.*) /api/$1 break;
        proxy_pass http://localhost:8001;
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

        # CORS headers
        add_header Access-Control-Allow-Origin "https://tricomar.store" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Página principal (opcional - puedes mostrar otra cosa aquí)
    location / {
        root /var/www/html;
        index index.html index.htm;
    }

    # Logs
    access_log /var/log/nginx/ventas-app-access.log;
    error_log /var/log/nginx/ventas-app-error.log;
}
NGINXCONF

# Verificar configuración
nginx -t

# Recargar Nginx
systemctl reload nginx

# Configurar renovación automática
print_message "Configurando renovación automática de certificados..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
print_message "==================================================================="
print_message "✓ SSL configurado exitosamente!"
print_message "==================================================================="
echo ""
print_message "Tu aplicación está disponible en:"
echo "  🔒 https://$DOMAIN/appventas"
echo ""
print_message "Detalles:"
echo "  - Certificado SSL: Let's Encrypt"
echo "  - Renovación automática: Activada (cada 60 días)"
echo "  - Redirección HTTP -> HTTPS: Activada"
echo ""
print_message "Comandos útiles:"
echo "  - Ver estado de certificado: sudo certbot certificates"
echo "  - Renovar manualmente: sudo certbot renew"
echo "  - Ver logs de Nginx: sudo tail -f /var/log/nginx/ventas-app-error.log"
echo ""
print_message "¡Todo listo! Accede a tu aplicación de forma segura."
