"""
Script para actualizar los códigos de tienda en los productos
Mapea A -> PT, B -> ST, C -> TT
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

# Mapeo de códigos antiguos a nuevos
CODE_MAPPING = {
    'A': 'PT',
    'B': 'ST',
    'C': 'TT'
}

async def update_product_codes():
    """
    Actualiza los códigos de tienda en los productos
    """
    print("🚀 Actualizando códigos de productos...")
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Obtener todos los productos
        products = await db.products.find({}, {"_id": 0}).to_list(10000)
        
        print(f"📦 Encontrados {len(products)} productos")
        
        updated_count = 0
        
        for product in products:
            product_id = product.get("id")
            old_store = product.get("store")
            
            if old_store in CODE_MAPPING:
                new_store = CODE_MAPPING[old_store]
                
                # Actualizar el producto
                await db.products.update_one(
                    {"id": product_id},
                    {"$set": {"store": new_store}}
                )
                
                print(f"  ✏️  Producto '{product.get('name')}': {old_store} -> {new_store}")
                updated_count += 1
        
        print(f"\n✅ Actualizados {updated_count} productos")
        
        # Verificar algunos productos
        print("\n🔍 Verificando productos actualizados...")
        sample_products = await db.products.find({}, {"_id": 0}).limit(5).to_list(5)
        for prod in sample_products:
            print(f"  - {prod.get('name')}: Código {prod.get('store')}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(update_product_codes())
