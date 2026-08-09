"""
Script de migración: Añadir store_id a órdenes existentes

Este script busca todas las órdenes en ecommerce_orders que no tienen store_id
y lo añade obteniendo el store_id de su integración correspondiente.
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


async def migrate_orders():
    """Migrar órdenes existentes para añadir store_id"""
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 70)
    print("🔄 MIGRACIÓN: Añadir store_id a órdenes existentes")
    print("=" * 70)
    
    # 1. Contar órdenes sin store_id
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
    
    # 2. Obtener todas las integraciones
    integrations = await db.prestashop_integrations.find({}, {'_id': 0}).to_list(1000)
    integrations_map = {i['id']: i.get('store_id') for i in integrations if 'store_id' in i}
    
    print(f"\n🔗 Integraciones encontradas: {len(integrations_map)}")
    for int_id, store_id in integrations_map.items():
        print(f"   {int_id[:8]}... → store_id: {store_id}")
    
    # 3. Migrar órdenes
    print(f"\n🔄 Migrando {orders_without_store} órdenes...")
    
    migrated_count = 0
    skipped_count = 0
    error_count = 0
    
    # Obtener órdenes sin store_id
    orders = db.ecommerce_orders.find({'store_id': {'$exists': False}}, {'_id': 0})
    
    async for order in orders:
        try:
            integration_id = order.get('integration_id')
            
            if not integration_id:
                print(f"   ⚠️  Orden {order.get('id')} sin integration_id - omitida")
                skipped_count += 1
                continue
            
            # Buscar store_id de la integración
            store_id = integrations_map.get(integration_id)
            
            if not store_id:
                # Intentar buscar la integración directamente
                integration = await db.prestashop_integrations.find_one(
                    {'id': integration_id},
                    {'_id': 0, 'store_id': 1}
                )
                
                if integration and 'store_id' in integration:
                    store_id = integration['store_id']
                else:
                    print(f"   ⚠️  Orden {order.get('id')} - integración {integration_id[:8]}... no encontrada o sin store_id")
                    skipped_count += 1
                    continue
            
            # Actualizar orden con store_id
            result = await db.ecommerce_orders.update_one(
                {
                    'account_id': order['account_id'],
                    'integration_id': integration_id,
                    'id': order['id']
                },
                {'$set': {
                    'store_id': store_id,
                    'migrated_at': datetime.now(timezone.utc).isoformat()
                }}
            )
            
            if result.modified_count > 0:
                migrated_count += 1
                if migrated_count % 10 == 0:
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
    print(f"⚠️  Omitidas (sin integración): {skipped_count}")
    print(f"❌ Errores: {error_count}")
    print(f"\n📊 Estado final:")
    print(f"   Total órdenes: {total_orders}")
    print(f"   ✅ Con store_id: {orders_with_store_after}")
    print(f"   ❌ Sin store_id: {orders_without_store_after}")
    
    if orders_without_store_after == 0:
        print("\n🎉 ¡Migración completada exitosamente!")
    else:
        print(f"\n⚠️  Quedan {orders_without_store_after} órdenes sin store_id")
        print("   Estas órdenes pueden no tener integración válida.")
    
    client.close()


if __name__ == "__main__":
    print("\n⚠️  ADVERTENCIA: Este script modificará las órdenes en la base de datos.")
    print("   Se añadirá el campo 'store_id' a las órdenes existentes.\n")
    
    response = input("¿Deseas continuar? (s/n): ")
    
    if response.lower() == 's':
        asyncio.run(migrate_orders())
        print("\n✅ Migración finalizada.\n")
    else:
        print("\n❌ Migración cancelada.\n")
