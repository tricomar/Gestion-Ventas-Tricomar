"""
Script para listar todas las colecciones y sus documentos
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

async def list_collections():
    """
    Lista todas las colecciones y cuenta documentos
    """
    print("🔍 Listando colecciones...")
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Listar colecciones
        collections = await db.list_collection_names()
        
        print(f"\n📦 Encontradas {len(collections)} colecciones:\n")
        
        for collection_name in collections:
            count = await db[collection_name].count_documents({})
            print(f"  - {collection_name}: {count} documentos")
            
            # Si es products o inventory, mostrar algunos ejemplos
            if collection_name in ['products', 'inventory'] and count > 0:
                print(f"\n    Ejemplos de {collection_name}:")
                samples = await db[collection_name].find({}, {"_id": 0}).limit(3).to_list(3)
                for i, doc in enumerate(samples, 1):
                    print(f"      {i}. {doc.get('name', 'Sin nombre')} - Store: {doc.get('store', 'N/A')}")
                print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(list_collections())
