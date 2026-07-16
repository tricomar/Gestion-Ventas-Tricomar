"""
Script para inicializar el super-admin del sistema
"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

sys.path.insert(0, str(ROOT_DIR))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import bcrypt
import uuid

# Configuración desde .env
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sales_db')

print(f"📊 Usando base de datos: {DB_NAME}")
print(f"🔗 MongoDB URL: {MONGO_URL}")

SUPER_ADMIN_EMAIL = "carlos@tricomar.cl"
SUPER_ADMIN_PASSWORD = "QWEasd123$"
SUPER_ADMIN_NAME = "Carlos - Super Admin"

async def init_super_admin():
    """
    Crea el usuario super-admin en la base de datos.
    Si ya existe, actualiza su contraseña.
    """
    print("🚀 Inicializando Super-Admin...")
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Verificar si ya existe
        existing = await db.users.find_one({"email": SUPER_ADMIN_EMAIL})
        
        # Hash de contraseña
        password_hash = bcrypt.hashpw(
            SUPER_ADMIN_PASSWORD.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        if existing:
            print(f"⚠️  Super-admin ya existe. Actualizando...")
            
            # Actualizar
            await db.users.update_one(
                {"email": SUPER_ADMIN_EMAIL},
                {
                    "$set": {
                        "password_hash": password_hash,
                        "role": "super_admin",
                        "name": SUPER_ADMIN_NAME,
                        "account_id": None,
                        "is_account_owner": False
                    }
                }
            )
            
            print(f"✅ Super-admin actualizado exitosamente")
        else:
            print(f"📝 Creando nuevo super-admin...")
            
            # Crear nuevo
            super_admin = {
                "id": str(uuid.uuid4()),
                "email": SUPER_ADMIN_EMAIL,
                "password_hash": password_hash,
                "name": SUPER_ADMIN_NAME,
                "role": "super_admin",
                "account_id": None,
                "is_account_owner": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(super_admin)
            
            print(f"✅ Super-admin creado exitosamente")
        
        print(f"\n📧 Email: {SUPER_ADMIN_EMAIL}")
        print(f"🔑 Password: {SUPER_ADMIN_PASSWORD}")
        print(f"\n⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro\n")
        
        # Crear índices si no existen
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.accounts.create_index("id", unique=True)
        await db.accounts.create_index("owner_user_id")
        
        print("✅ Índices de base de datos verificados")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(init_super_admin())
