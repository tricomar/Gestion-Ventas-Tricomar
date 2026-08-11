"""
Script de migración para agregar campo webhook_active a integraciones PrestaShop existentes
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils import db
from datetime import datetime, timezone


async def migrate_webhook_active():
    """Agregar webhook_active: False a todas las integraciones existentes que no lo tienen"""
    print("🔄 Iniciando migración webhook_active...")
    
    # Buscar todas las integraciones sin el campo webhook_active
    integrations = await db.prestashop_integrations.find(
        {'webhook_active': {'$exists': False}},
        {'_id': 0, 'id': 1, 'shop_url': 1}
    ).to_list(1000)
    
    if not integrations:
        print("✅ No hay integraciones que necesiten migración.")
        return
    
    print(f"📊 Encontradas {len(integrations)} integraciones sin webhook_active")
    
    updated_count = 0
    for integration in integrations:
        result = await db.prestashop_integrations.update_one(
            {'id': integration['id']},
            {'$set': {
                'webhook_active': False,
                'last_webhook_at': None
            }}
        )
        if result.modified_count > 0:
            updated_count += 1
            print(f"  ✓ Actualizada: {integration.get('shop_url', integration['id'])}")
    
    print(f"\n✅ Migración completada: {updated_count}/{len(integrations)} integraciones actualizadas")


if __name__ == "__main__":
    asyncio.run(migrate_webhook_active())
