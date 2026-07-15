# 🚀 Deployment Scripts - Negocio Feliz

## Scripts Disponibles

### 1. `install_dependencies.sh`
Instala todas las dependencias necesarias del proyecto.

```bash
chmod +x install_dependencies.sh
./install_dependencies.sh
```

### 2. `start_production.sh`
Inicia la aplicación en modo producción.

```bash
chmod +x start_production.sh
./start_production.sh
```

### 3. `docker-compose.yml`
Configuración de Docker Compose para deployment con contenedores.

```bash
docker-compose up -d
```

## Requisitos del Sistema

### Backend
- Python 3.9+
- MongoDB 7.0+
- Dependencias en `/app/backend/requirements.txt`

### Frontend
- Node.js 18+
- Yarn
- Dependencias en `/app/frontend/package.json`

## Variables de Entorno

### Backend (`/app/backend/.env`)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=your-secret-key-here
```

### Frontend (`/app/frontend/.env`)
```
REACT_APP_BACKEND_URL=http://your-domain.com
```

## Deployment a Producción

### Opción 1: Servidor Linux (Ubuntu/Debian)

1. **Instalar dependencias del sistema**:
```bash
sudo apt update
sudo apt install -y python3 python3-pip nodejs npm mongodb
npm install -g yarn
```

2. **Clonar repositorio**:
```bash
git clone <tu-repositorio>
cd <tu-proyecto>
```

3. **Configurar variables de entorno**:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Editar los archivos .env con tus valores
```

4. **Instalar dependencias**:
```bash
cd deploy
./install_dependencies.sh
```

5. **Iniciar aplicación**:
```bash
./start_production.sh
```

### Opción 2: Docker

1. **Instalar Docker y Docker Compose**

2. **Configurar variables de entorno**:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. **Iniciar contenedores**:
```bash
cd deploy
docker-compose up -d
```

4. **Ver logs**:
```bash
docker-compose logs -f
```

## Nginx (Opcional)

Para servir la aplicación con Nginx:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Notas Importantes

⚠️ **Seguridad**:
- Cambia `JWT_SECRET` en producción
- Usa HTTPS en producción
- Configura firewall para proteger MongoDB
- No expongas MongoDB públicamente

📝 **Mantenimiento**:
- Haz backups regulares de MongoDB
- Monitorea logs del sistema
- Actualiza dependencias regularmente

🔄 **Actualizaciones**:
Cuando agregues nuevas dependencias, actualiza:
- `/app/backend/requirements.txt` (Python)
- `/app/frontend/package.json` (Node.js)
- Este README si es necesario
