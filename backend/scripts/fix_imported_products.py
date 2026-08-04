"""
Script para corregir productos importados de PrestaShop con store y category incorrectos
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def fix_products():
    # Conectar a MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'sales_ledger')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔍 Buscando productos importados de PrestaShop...")
    
    # Buscar todos los productos con prestashop_id
    products = await db.products.find({'prestashop_id': {'$exists': True}}, {'_id': 0}).to_list(10000)
    
    if not products:
        print("❌ No se encontraron productos importados de PrestaShop")
        return
    
    print(f"✓ Encontrados {len(products)} productos importados")
    
    updated_count = 0
    
    for product in products:
        account_id = product.get('account_id')
        integration_id = product.get('prestashop_integration_id')
        prestashop_id = product.get('prestashop_id')
        sku = product.get('sku')
        
        if not all([account_id, integration_id, prestashop_id]):
            continue
        
        updates = {}
        
        # 1. CORREGIR STORE CODE
        # Obtener el código correcto de la tienda
        account = await db.accounts.find_one({'id': account_id}, {'_id': 0})
        if account and 'stores' in account:
            integration = await db.prestashop_integrations.find_one(
                {'id': integration_id},
                {'_id': 0}
            )
            if integration:
                store_id = integration.get('store_id')
                matching_store = next((s for s in account['stores'] if s.get('id') == store_id), None)
                if matching_store:
                    correct_store_code = matching_store.get('code', 'A')
                    if product.get('store') != correct_store_code:
                        updates['store'] = correct_store_code
                        print(f"  • {product.get('name')[:50]}: store '{product.get('store')}' → '{correct_store_code}'")
        
        # 2. CORREGIR CATEGORÍA
        if product.get('category') == 'Importado PrestaShop':
            # Buscar categoría real en PrestaShop
            ps_product = await db.prestashop_products.find_one(
                {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': prestashop_id},
                {'_id': 0}
            )
            
            if ps_product:
                category_id = ps_product.get('category_id', 0)
                if category_id > 0:
                    ps_category = await db.prestashop_categories.find_one(
                        {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': category_id},
                        {'_id': 0}
                    )
                    if ps_category:
                        category_name = ps_category.get('name', 'Sin categoría')
                        updates['category'] = category_name
                        print(f"  • {product.get('name')[:50]}: category 'Importado PrestaShop' → '{category_name}'")
        
        # Aplicar actualizaciones
        if updates:
            updates['updated_at'] = datetime.now(timezone.utc).isoformat()
            await db.products.update_one(
                {'account_id': account_id, 'sku': sku},
                {'$set': updates}
            )
            updated_count += 1
    
    print(f"\n✅ Migración completada: {updated_count} productos actualizados")
    
    # Verificar resultados
    print("\n🔍 Verificando productos después de migración...")
    sample_products = await db.products.find(
        {'prestashop_id': {'$exists': True}},
        {'_id': 0, 'name': 1, 'store': 1, 'category': 1}
    ).limit(5).to_list(10)
    
    for p in sample_products:
        print(f"  • {p.get('name')[:50]}")
        print(f"    Store: {p.get('store')}")
        print(f"    Category: {p.get('category')}")

if __name__ == '__main__':
    asyncio.run(fix_products())
