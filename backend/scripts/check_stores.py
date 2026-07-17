"""
Script para verificar los códigos de las tiendas en la base de datos
"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import json

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

async def check_stores():
    """
    Verifica los códigos de las tiendas en todas las cuentas
    """
    print("🔍 Verificando tiendas...")
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Obtener todas las cuentas
        accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
        
        print(f"\n📦 Encontradas {len(accounts)} cuentas\n")
        
        for account in accounts:
            account_id = account.get("id")
            business_name = account.get("business_name", "Sin nombre")
            stores = account.get("stores", [])
            
            print(f"🏢 Cuenta: {business_name} (ID: {account_id})")
            print(f"   Plan: {account.get('plan')}, Max stores: {account.get('max_stores')}")
            
            if not stores:
                print("   ⚠️  Sin tiendas")
            else:
                print(f"   Tiendas ({len(stores)}):")
                for i, store in enumerate(stores):
                    store_id = store.get("id", "N/A")
                    store_name = store.get("name", "Sin nombre")
                    store_code = store.get("code", "❌ SIN CÓDIGO")
                    store_active = store.get("active", True)
                    
                    print(f"     {i+1}. {store_name}")
                    print(f"        ID: {store_id}")
                    print(f"        Código: {store_code}")
                    print(f"        Activa: {store_active}")
            
            print()
        
        # Buscar específicamente la cuenta de prueba
        print("\n🔍 Buscando cuenta de prueba (hola@tricomar.cl)...")
        test_user = await db.users.find_one({"email": "hola@tricomar.cl"}, {"_id": 0})
        
        if test_user:
            print(f"✅ Usuario encontrado: {test_user.get('name')}")
            print(f"   Account ID: {test_user.get('account_id')}")
            
            test_account = await db.accounts.find_one({"id": test_user.get('account_id')}, {"_id": 0})
            
            if test_account:
                print(f"\n📋 Detalles de la cuenta de prueba:")
                print(f"   Business: {test_account.get('business_name')}")
                print(f"   Plan: {test_account.get('plan')}")
                print(f"   Max stores: {test_account.get('max_stores')}")
                print(f"\n   Tiendas:")
                for i, store in enumerate(test_account.get("stores", [])):
                    print(f"     {i+1}. {json.dumps(store, indent=8)}")
        else:
            print("❌ Usuario de prueba no encontrado")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_stores())
