"""
Script de limpieza: Borrar TODOS los datos de ecommerce sin integración activa

Este script elimina todos los datos huérfanos (datos cuya integración ya no existe)
"""

import asyncio
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'negocio_feliz')


async def clean_all_orphan_data():
    """Limpiar todos los datos huérfanos (sin integración activa)"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 70)
    print("🧹 LIMPIEZA COMPLETA: Borrar datos huérfanos de ecommerce")
    print("=" * 70)
    
    # 1. Contar datos actuales
    print(f"\n📊 Estado actual:")
    counts_before = {
        'ecommerce_orders': await db.ecommerce_orders.count_documents({}),
        'ecommerce_customers': await db.ecommerce_customers.count_documents({}),
        'ecommerce_carts': await db.ecommerce_carts.count_documents({}),
        'prestashop_products': await db.prestashop_products.count_documents({}),
        'prestashop_categories': await db.prestashop_categories.count_documents({}),
        'prestashop_orders': await db.prestashop_orders.count_documents({}),
        'products': await db.products.count_documents({}),
        'categories': await db.categories.count_documents({}),
        'stock_conflicts': await db.stock_conflicts.count_documents({})
    }
    
    for key, count in counts_before.items():
        icon = "✅" if count > 0 else "❌"
        print(f"  {icon} {key}: {count}")
    
    total_before = sum(counts_before.values())
    
    if total_before == 0:
        print("\n✅ No hay datos para limpiar.")
        client.close()
        return
    
    # 2. Eliminar TODOS los datos
    print(f"\n🗑️  Eliminando {total_before} registros...")
    
    results = {}
    
    # Eliminar órdenes
    result = await db.ecommerce_orders.delete_many({})
    results['ecommerce_orders'] = result.deleted_count
    
    # Eliminar clientes ecommerce
    result = await db.ecommerce_customers.delete_many({})
    results['ecommerce_customers'] = result.deleted_count
    
    # Eliminar carritos
    result = await db.ecommerce_carts.delete_many({})
    results['ecommerce_carts'] = result.deleted_count
    
    # Eliminar productos PrestaShop
    result = await db.prestashop_products.delete_many({})
    results['prestashop_products'] = result.deleted_count
    
    # Eliminar categorías PrestaShop
    result = await db.prestashop_categories.delete_many({})
    results['prestashop_categories'] = result.deleted_count
    
    # Eliminar órdenes PrestaShop
    result = await db.prestashop_orders.delete_many({})
    results['prestashop_orders'] = result.deleted_count
    
    # Eliminar productos inventario
    result = await db.products.delete_many({})
    results['products'] = result.deleted_count
    
    # Eliminar categorías locales
    result = await db.categories.delete_many({})
    results['categories'] = result.deleted_count
    
    # Eliminar conflictos de stock
    result = await db.stock_conflicts.delete_many({})
    results['stock_conflicts'] = result.deleted_count
    
    # 3. Verificar resultado
    print("\n" + "=" * 70)
    print("📊 RESULTADO DE LIMPIEZA")
    print("=" * 70)
    
    total_deleted = 0
    for key, count in results.items():
        if count > 0:
            print(f"  ✅ {key}: {count} eliminados")
            total_deleted += count
        else:
            print(f"  ❌ {key}: 0 (ya estaba vacío)")
    
    print(f"\n🎉 Total eliminados: {total_deleted} registros")
    
    # 4. Verificar estado final
    counts_after = {
        'ecommerce_orders': await db.ecommerce_orders.count_documents({}),
        'ecommerce_customers': await db.ecommerce_customers.count_documents({}),
        'ecommerce_carts': await db.ecommerce_carts.count_documents({}),
        'products': await db.products.count_documents({})
    }
    
    print(f"\n📊 Estado final:")
    for key, count in counts_after.items():
        icon = "✅" if count == 0 else "⚠️"
        print(f"  {icon} {key}: {count}")
    
    if sum(counts_after.values()) == 0:
        print("\n✅ Base de datos limpia. Lista para nuevas sincronizaciones.")
    else:
        print(f"\n⚠️  Aún quedan {sum(counts_after.values())} registros.")
    
    client.close()


if __name__ == "__main__":
    print("\n⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de ecommerce.")
    print("   - Órdenes")
    print("   - Clientes")
    print("   - Carritos")
    print("   - Productos")
    print("   - Categorías")
    print("   - Conflictos de stock")
    print("\n   Las integraciones configuradas NO se eliminarán.\n")
    
    response = input("¿Deseas continuar? (s/n): ")
    
    if response.lower() == 's':
        asyncio.run(clean_all_orphan_data())
        print("\n✅ Limpieza finalizada.\n")
    else:
        print("\n❌ Limpieza cancelada.\n")
