"""
Script para agregar códigos a las tiendas existentes que no los tienen
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

# Configuración desde .env
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sales_db')

print(f"📊 Usando base de datos: {DB_NAME}")
print(f"🔗 MongoDB URL: {MONGO_URL}")

# Mapeo de nombres de tiendas a códigos
STORE_NAME_TO_CODE = {
    "petshop": "PT",
    "growshop": "ST",
    "tabaqueria": "TT",
    "tabaquería": "TT",
    "primera tienda": "PT"
}

async def add_store_codes():
    """
    Agrega códigos a las tiendas que no los tienen
    """
    print("🚀 Agregando códigos a tiendas...")
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Obtener todas las cuentas
        accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
        
        print(f"📦 Encontradas {len(accounts)} cuentas")
        
        updated_count = 0
        
        for account in accounts:
            account_id = account.get("id")
            stores = account.get("stores", [])
            
            if not stores:
                continue
            
            updated_stores = []
            needs_update = False
            
            for i, store in enumerate(stores):
                # Si la tienda ya tiene código, mantenerlo
                if store.get("code"):
                    updated_stores.append(store)
                    continue
                
                # Si no tiene código, asignarlo basado en el nombre o posición
                store_name_lower = store.get("name", "").lower()
                
                # Intentar mapear por nombre
                code = None
                for name_key, code_value in STORE_NAME_TO_CODE.items():
                    if name_key in store_name_lower:
                        code = code_value
                        break
                
                # Si no se encontró por nombre, asignar por posición
                if not code:
                    # PT, ST, TT, UT, VT, etc.
                    code = chr(80 + i) + "T"  # P=80, S=83, T=84, U=85, V=86
                
                store["code"] = code
                updated_stores.append(store)
                needs_update = True
                
                print(f"  ✏️  Cuenta {account_id}: Tienda '{store.get('name')}' -> Código '{code}'")
            
            # Actualizar la cuenta si hubo cambios
            if needs_update:
                await db.accounts.update_one(
                    {"id": account_id},
                    {"$set": {"stores": updated_stores}}
                )
                updated_count += 1
        
        print(f"\n✅ Actualizadas {updated_count} cuentas")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(add_store_codes())
