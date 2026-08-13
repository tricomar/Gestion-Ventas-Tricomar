"""
Script para corregir productos existentes:
1. Actualizar store code de 'A' al código correcto de la tienda
2. Poblar brand y category desde PrestaShop
"""
import asyncio
import sys
sys.path.insert(0, '/app/backend')
from utils import db
from services.prestashop_service import PrestashopAPIService

async def fix_products():
    print('=== CORRECCIÓN DE PRODUCTOS ===\n')
    
    # 1. Obtener integraciones
    integrations = await db.prestashop_integrations.find({}, {'_id': 0}).to_list(10)
    
    if not integrations:
        print('No hay integraciones PrestaShop')
        return
    
    for integ in integrations:
        print(f'\n=== Integración: {integ["shop_url"]} ===')
        
        # Obtener cuenta y código de tienda
        account = await db.accounts.find_one(
            {'id': integ['account_id']},
            {'_id': 0, 'stores': 1}
        )
        
        store_code = None
        if account and 'stores' in account:
            for store in account['stores']:
                if store.get('id') == integ['store_id']:
                    store_code = store.get('code')
                    print(f'Código de tienda: {store_code}')
                    break
        
        if not store_code:
            print('No se encontró código de tienda, usando A')
            store_code = 'A'
        
        # Crear servicio PrestaShop
        ps_service = PrestashopAPIService(integ['shop_url'], integ['api_key'])
        
        # Cargar mapas de manufacturers y categories
        print('Cargando manufacturers...')
        try:
            response = ps_service._make_request('manufacturers', params={'display': '[id,name]'})
            manufacturers = response.get('manufacturers', [])
            if isinstance(manufacturers, dict):
                manufacturers = [manufacturers]
            manufacturers_map = {int(m.get('id')): m.get('name') for m in manufacturers if m.get('id')}
            print(f'  → {len(manufacturers_map)} manufacturers cargados')
        except Exception as e:
            print(f'  Error: {e}')
            manufacturers_map = {}
        
        print('Cargando categories...')
        try:
            response = ps_service._make_request('categories', params={'display': '[id,name]'})
            categories = response.get('categories', [])
            if isinstance(categories, dict):
                categories = [categories]
            categories_map = {int(c.get('id')): c.get('name') for c in categories if c.get('id')}
            print(f'  → {len(categories_map)} categories cargadas')
        except Exception as e:
            print(f'  Error: {e}')
            categories_map = {}
        
        # Obtener productos de esta integración
        products = await db.products.find({
            'prestashop_integration_id': integ['id']
        }, {'_id': 0}).to_list(10000)
        
        print(f'\nProductos a corregir: {len(products)}')
        
        updated_count = 0
        for product in products:
            updates = {}
            
            # 1. Corregir store code
            if product.get('store') != store_code:
                updates['store'] = store_code
            
            # 2. Poblar brand si está vacío
            if not product.get('brand'):
                # Obtener desde PrestaShop
                try:
                    ps_id = product.get('prestashop_id')
                    if ps_id:
                        ps_prod = ps_service.get_product(ps_id)
                        man_id = ps_prod.get('id_manufacturer')
                        if man_id:
                            man_id_int = int(man_id)
                            if man_id_int in manufacturers_map:
                                updates['brand'] = manufacturers_map[man_id_int]
                except Exception as e:
                    pass
            
            # 3. Poblar category si está vacío
            if not product.get('category'):
                # Obtener desde PrestaShop
                try:
                    ps_id = product.get('prestashop_id')
                    if ps_id:
                        ps_prod = ps_service.get_product(ps_id)
                        cat_id = ps_prod.get('id_category_default')
                        if cat_id:
                            cat_id_int = int(cat_id)
                            if cat_id_int in categories_map:
                                updates['category'] = categories_map[cat_id_int]
                except Exception as e:
                    pass
            
            # Actualizar si hay cambios
            if updates:
                await db.products.update_one(
                    {'id': product['id']},
                    {'$set': updates}
                )
                updated_count += 1
                if updated_count % 50 == 0:
                    print(f'  Actualizados: {updated_count}/{len(products)}')
        
        print(f'✓ Total actualizados: {updated_count}/{len(products)}')
    
    print('\n=== CORRECCIÓN COMPLETADA ===')

if __name__ == '__main__':
    asyncio.run(fix_products())
