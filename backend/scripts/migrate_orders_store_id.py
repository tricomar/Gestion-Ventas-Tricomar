"""
Script de migración: Añadir store_id a órdenes existentes usando store_name

Este script busca todas las órdenes en ecommerce_orders que no tienen store_id
y lo añade mapeando store_name con las tiendas en account.stores
"""

import asyncio
import os
import sys
from pathlib import Path

# Añadir path del backend al PYTHONPATH
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# Configuración MongoDB
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'negocio_feliz')


async def migrate_orders_by_store_name():
    """Migrar órdenes existentes para añadir store_id usando store_name"""
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 70)
    print("🔄 MIGRACIÓN: Añadir store_id a órdenes usando store_name")
    print("=" * 70)
    
    # 1. Obtener cuentas y sus tiendas
    accounts = await db.accounts.find({}, {'_id': 0, 'id': 1, 'stores': 1}).to_list(100)
    
    # Crear mapeo store_name → store_id por cuenta
    store_mapping = {}  # {account_id: {store_name: store_id}}
    
    print(f"\n🏪 Construyendo mapeo de tiendas...")
    for account in accounts:
        account_id = account.get('id')
        stores = account.get('stores', [])
        
        if not stores:
            continue
            
        store_mapping[account_id] = {}
        print(f"\n   Account: {account_id}")
        
        for store in stores:
            store_id = store.get('id')
            store_name = store.get('name')
            store_code = store.get('code') or store.get('key')
            
            if store_name and store_id:
                store_mapping[account_id][store_name] = store_id
                print(f"      {store_name} → {store_id} (code: {store_code})")
    
    if not store_mapping:
        print("\n❌ No se encontraron tiendas en ninguna cuenta.")
        client.close()
        return
    
    # 2. Contar órdenes sin store_id
    orders_without_store = await db.ecommerce_orders.count_documents({'store_id': {'$exists': False}})
    orders_with_store = await db.ecommerce_orders.count_documents({'store_id': {'$exists': True}})
    total_orders = await db.ecommerce_orders.count_documents({})
    
    print(f"\n📊 Estado actual:")
    print(f"   Total órdenes: {total_orders}")
    print(f"   ✅ Con store_id: {orders_with_store}")
    print(f"   ❌ Sin store_id: {orders_without_store}")
    
    if orders_without_store == 0:
        print("\n✅ No hay órdenes por migrar. Todas tienen store_id.")
        client.close()
        return
    
    # 3. Migrar órdenes
    print(f"\n🔄 Migrando {orders_without_store} órdenes usando store_name...")
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    # Obtener órdenes sin store_id
    orders = db.ecommerce_orders.find({'store_id': {'$exists': False}}, {'_id': 0})
    
    async for order in orders:
        try:
            account_id = order.get('account_id')
            store_name = order.get('store_name')
            order_id = order.get('id')
            
            if not account_id or not store_name:
                print(f"   ⚠️  Orden {order_id} sin account_id o store_name - omitida")
                skipped_count += 1
                continue
            
            # Buscar store_id usando el mapeo
            account_stores = store_mapping.get(account_id, {})
            store_id = account_stores.get(store_name)
            
            if not store_id:
                print(f"   ⚠️  Orden {order_id}: store_name '{store_name}' no encontrado en account {account_id}")
                skipped_count += 1
                continue
            
            # Actualizar orden con store_id
            result = await db.ecommerce_orders.update_one(
                {
                    'account_id': account_id,
                    'id': order_id
                },
                {'$set': {
                    'store_id': store_id,
                    'migrated_at': datetime.now(timezone.utc).isoformat()
                }}
            )
            
            if result.modified_count > 0:
                migrated_count += 1
                if migrated_count % 20 == 0:
                    print(f"   ✅ {migrated_count} órdenes migradas...")
            
        except Exception as e:
            error_count += 1
            print(f"   ❌ Error en orden {order.get('id')}: {str(e)}")
    
    # 4. Verificar resultado final
    orders_without_store_after = await db.ecommerce_orders.count_documents({'store_id': {'$exists': False}})
    orders_with_store_after = await db.ecommerce_orders.count_documents({'store_id': {'$exists': True}})
    
    print("\n" + "=" * 70)
    print("📊 RESULTADO DE MIGRACIÓN")
    print("=" * 70)
    print(f"✅ Migradas exitosamente: {migrated_count}")
    print(f"⚠️  Omitidas (sin mapeo): {skipped_count}")
    print(f"❌ Errores: {error_count}")
    print(f"\n📊 Estado final:")
    print(f"   Total órdenes: {total_orders}")
    print(f"   ✅ Con store_id: {orders_with_store_after}")
    print(f"   ❌ Sin store_id: {orders_without_store_after}")
    
    # 5. Mostrar distribución por tienda
    print(f"\n📊 Distribución de órdenes por tienda:")
    pipeline = [
        {'$match': {'store_id': {'$exists': True}}},
        {'$group': {'_id': '$store_id', 'count': {'$sum': 1}}}
    ]
    distribution = await db.ecommerce_orders.aggregate(pipeline).to_list(100)
    
    for item in distribution:
        store_id = item['_id']
        count = item['count']
        
        # Buscar nombre de tienda
        store_name = "Desconocida"
        for acc_id, stores in store_mapping.items():
            for name, sid in stores.items():
                if sid == store_id:
                    store_name = name
                    break
        
        print(f"   {store_name} ({store_id}): {count} órdenes")
    
    if orders_without_store_after == 0:
        print("\n🎉 ¡Migración completada exitosamente!")
    else:
        print(f"\n⚠️  Quedan {orders_without_store_after} órdenes sin store_id")
        print("   Estas órdenes pueden no tener store_name válido.")
    
    client.close()


if __name__ == "__main__":
    print("\n⚠️  ADVERTENCIA: Este script modificará las órdenes en la base de datos.")
    print("   Se añadirá el campo 'store_id' a las órdenes existentes basándose en 'store_name'.\n")
    
    response = input("¿Deseas continuar? (s/n): ")
    
    if response.lower() == 's':
        asyncio.run(migrate_orders_by_store_name())
        print("\n✅ Migración finalizada.\n")
    else:
        print("\n❌ Migración cancelada.\n")
