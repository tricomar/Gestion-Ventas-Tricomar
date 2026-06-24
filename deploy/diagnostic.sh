#!/bin/bash

################################################################################
# Script de Diagnóstico - Sistema de Gestión de Ventas
# Identifica problemas de registro y conectividad
################################################################################

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================${NC}"
}

print_ok() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

DOMAIN="tricomar.store"
APP_PATH="/appventas"
APP_NAME="ventas-app"
BACKEND_PORT=8001

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  DIAGNÓSTICO - Sistema de Gestión de Ventas   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"

# 1. Verificar servicios
print_header "1. Estado de Servicios"

# MongoDB
if systemctl is-active --quiet mongod; then
    print_ok "MongoDB: Running"
else
    print_error "MongoDB: Stopped"
    echo "   Ejecuta: sudo systemctl start mongod"
fi

# Backend
if systemctl is-active --quiet $APP_NAME-backend; then
    print_ok "Backend FastAPI: Running"
else
    print_error "Backend FastAPI: Stopped"
    echo "   Ejecuta: sudo systemctl start $APP_NAME-backend"
fi

# Nginx
if systemctl is-active --quiet nginx; then
    print_ok "Nginx: Running"
else
    print_error "Nginx: Stopped"
    echo "   Ejecuta: sudo systemctl start nginx"
fi

# 2. Verificar puertos
print_header "2. Puertos Abiertos"

if netstat -tuln | grep -q ":$BACKEND_PORT "; then
    print_ok "Backend escuchando en puerto $BACKEND_PORT"
else
    print_error "Backend NO escuchando en puerto $BACKEND_PORT"
fi

if netstat -tuln | grep -q ":27017 "; then
    print_ok "MongoDB escuchando en puerto 27017"
else
    print_error "MongoDB NO escuchando en puerto 27017"
fi

# 3. Logs del Backend (últimos errores)
print_header "3. Logs del Backend (últimos 20 errores/warnings)"
echo ""
journalctl -u $APP_NAME-backend --no-pager -n 20 --grep="ERROR\|WARNING\|Exception\|Traceback" || echo "Sin errores recientes"

# 4. Test de conectividad MongoDB
print_header "4. Conectividad MongoDB"
python3 << 'PYEOF'
import sys
try:
    from pymongo import MongoClient
    client = MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000)
    client.admin.command('ping')
    print("\033[0;32m✓\033[0m MongoDB conectado correctamente")
    
    # Verificar base de datos
    db = client['ventas_db']
    collections = db.list_collection_names()
    print(f"\033[0;32m✓\033[0m Base de datos 'ventas_db' existe")
    print(f"  Colecciones: {', '.join(collections) if collections else 'Ninguna (DB vacía)'}")
    
    # Verificar si hay usuarios
    users_count = db.users.count_documents({})
    print(f"\033[0;32m✓\033[0m Usuarios registrados: {users_count}")
    
    client.close()
except ImportError:
    print("\033[0;31m✗\033[0m pymongo no instalado")
    print("  Instala: pip3 install pymongo")
    sys.exit(1)
except Exception as e:
    print(f"\033[0;31m✗\033[0m Error conectando a MongoDB: {e}")
    sys.exit(1)
PYEOF

# 5. Test del endpoint de registro (interno)
print_header "5. Test Endpoint /api/auth/register (Interno)"
REGISTER_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:$BACKEND_PORT/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_diagnostico@test.com",
    "password": "test123",
    "name": "Test Usuario",
    "role": "operator"
  }' 2>&1)

HTTP_CODE=$(echo "$REGISTER_TEST" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE=$(echo "$REGISTER_TEST" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" == "200" ] || [[ "$RESPONSE" == *"token"* ]]; then
    print_ok "Endpoint de registro funciona (HTTP $HTTP_CODE)"
    echo "   Respuesta: Usuario creado correctamente"
elif [[ "$RESPONSE" == *"already registered"* ]]; then
    print_ok "Endpoint funciona (usuario ya existe)"
else
    print_error "Endpoint de registro falla (HTTP $HTTP_CODE)"
    echo "   Respuesta: $RESPONSE"
fi

# 6. Test del endpoint de registro (público - a través de Nginx)
print_header "6. Test Endpoint Público (a través de Nginx)"
PUBLIC_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST https://$DOMAIN$APP_PATH/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test_publico@test.com",
    "password": "test123",
    "name": "Test Publico",
    "role": "operator"
  }' 2>&1)

HTTP_CODE_PUBLIC=$(echo "$PUBLIC_TEST" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_PUBLIC=$(echo "$PUBLIC_TEST" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE_PUBLIC" == "200" ] || [[ "$RESPONSE_PUBLIC" == *"token"* ]]; then
    print_ok "Endpoint público funciona (HTTP $HTTP_CODE_PUBLIC)"
elif [[ "$RESPONSE_PUBLIC" == *"already registered"* ]]; then
    print_ok "Endpoint público funciona (usuario ya existe)"
elif [ "$HTTP_CODE_PUBLIC" == "000" ] || [ -z "$HTTP_CODE_PUBLIC" ]; then
    print_error "No se puede conectar al endpoint público"
    echo "   ¿Está configurado el DNS correctamente?"
    echo "   ¿Está activo el certificado SSL?"
else
    print_error "Endpoint público falla (HTTP $HTTP_CODE_PUBLIC)"
    echo "   Respuesta: $RESPONSE_PUBLIC"
fi

# 7. Verificar configuración CORS
print_header "7. Configuración CORS"
CORS_CONFIG=$(grep -r "CORS_ORIGINS" /var/www/$APP_NAME/backend/.env 2>/dev/null)
if [ -n "$CORS_CONFIG" ]; then
    print_ok "CORS configurado: $CORS_CONFIG"
else
    print_warning "No se encontró configuración CORS"
fi

# 8. Verificar configuración de Nginx
print_header "8. Configuración de Nginx"
if nginx -t 2>&1 | grep -q "successful"; then
    print_ok "Configuración de Nginx válida"
else
    print_error "Configuración de Nginx tiene errores"
    nginx -t
fi

# Verificar que el proxy esté configurado
if grep -q "proxy_pass.*$BACKEND_PORT" /etc/nginx/sites-available/$APP_NAME; then
    print_ok "Proxy configurado para puerto $BACKEND_PORT"
else
    print_warning "No se encontró configuración de proxy"
fi

# 9. Logs de Nginx
print_header "9. Logs de Nginx (últimos errores)"
echo ""
tail -n 20 /var/log/nginx/$APP_NAME-error.log 2>/dev/null || echo "Sin logs de error"

# 10. Variables de entorno del backend
print_header "10. Variables de Entorno Backend"
if [ -f /var/www/$APP_NAME/backend/.env ]; then
    print_ok "Archivo .env existe"
    echo "   Contenido (sin secretos):"
    grep -v "JWT_SECRET" /var/www/$APP_NAME/backend/.env | sed 's/^/   /'
else
    print_error "Archivo .env NO encontrado"
fi

# Resumen y recomendaciones
print_header "RESUMEN Y RECOMENDACIONES"
echo ""

if ! systemctl is-active --quiet $APP_NAME-backend; then
    echo -e "${RED}🔴 PROBLEMA CRÍTICO:${NC} Backend no está corriendo"
    echo "   SOLUCIÓN: sudo systemctl start $APP_NAME-backend"
    echo "   Ver logs: sudo journalctl -u $APP_NAME-backend -f"
    echo ""
fi

if ! systemctl is-active --quiet mongod; then
    echo -e "${RED}🔴 PROBLEMA CRÍTICO:${NC} MongoDB no está corriendo"
    echo "   SOLUCIÓN: sudo systemctl start mongod"
    echo ""
fi

if [ "$HTTP_CODE" != "200" ] && [[ "$RESPONSE" != *"already"* ]] && [[ "$RESPONSE" != *"token"* ]]; then
    echo -e "${YELLOW}⚠ PROBLEMA:${NC} El endpoint de registro no funciona correctamente"
    echo "   Revisa los logs del backend arriba"
    echo "   Comando útil: sudo journalctl -u $APP_NAME-backend -f"
    echo ""
fi

echo -e "${GREEN}📋 COMANDOS ÚTILES:${NC}"
echo "   Ver logs backend:  sudo journalctl -u $APP_NAME-backend -f"
echo "   Ver logs nginx:    sudo tail -f /var/log/nginx/$APP_NAME-error.log"
echo "   Reiniciar backend: sudo systemctl restart $APP_NAME-backend"
echo "   Ver status:        sudo systemctl status $APP_NAME-backend"
echo ""
echo "   Probar registro:   curl -X POST https://$DOMAIN$APP_PATH/api/auth/register \\"
echo "                        -H 'Content-Type: application/json' \\"
echo "                        -d '{\"email\":\"test@test.com\",\"password\":\"123\",\"name\":\"Test\",\"role\":\"operator\"}'"
echo ""
