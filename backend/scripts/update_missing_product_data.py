"""
Script para actualizar productos existentes con datos faltantes:
- Resumen (description_short)
- Descripción (description)
- URL de Imagen (id_default_image)
- Peso (weight)
"""
import asyncio
import sys
import re
sys.path.insert(0, '/app/backend')
from utils import db
from services.prestashop_service import PrestashopAPIService

async def update_products():
    print('=== ACTUALIZACIÓN DE PRODUCTOS CON DATOS FALTANTES ===\n')
    
    # Obtener integraciones
    integrations = await db.prestashop_integrations.find({}, {'_id': 0}).to_list(10)
    
    if not integrations:
        print('No hay integraciones PrestaShop')
        return
    
    for integ in integrations:
        print(f'\n=== Integración: {integ["shop_url"]} ===')
        
        # Obtener productos sin datos completos
        products = await db.products.find({
            'prestashop_integration_id': integ['id'],
            'prestashop_id': {'$ne': None}
        }, {'_id': 0}).to_list(10000)
        
        print(f'Productos encontrados: {len(products)}')
        
        if not products:
            continue
        
        # Crear servicio PrestaShop
        ps_service = PrestashopAPIService(integ['shop_url'], integ['api_key'])
        
        updated_count = 0
        skipped_count = 0
        
        for product in products:
            try:
                ps_id = product['prestashop_id']
                
                # Verificar si ya tiene todos los datos
                has_all = (
                    product.get('summary') and
                    product.get('description') and
                    product.get('image_url') and
                    product.get('weight')
                )
                
                if has_all:
                    skipped_count += 1
                    continue
                
                # Obtener datos de PrestaShop usando _make_request
                ps_prod = ps_service._make_request(
                    f'products/{ps_id}',
                    params={'display': '[id,description_short,description,weight,id_default_image]'}
                )
                
                if not ps_prod or 'product' not in ps_prod:
                    continue
                
                ps_prod = ps_prod['product']
                
                updates = {}
                
                # Resumen
                if not product.get('summary') and ps_prod.get('description_short'):
                    summary = ps_prod['description_short']
                    if isinstance(summary, str):
                        summary = re.sub(r'<[^>]+>', '', summary).strip()
                        if summary:
                            updates['summary'] = summary[:250]
                
                # Descripción
                if not product.get('description') and ps_prod.get('description'):
                    description = ps_prod['description']
                    if isinstance(description, str) and description.strip():
                        updates['description'] = description.strip()
                
                # Peso
                if not product.get('weight') and ps_prod.get('weight'):
                    try:
                        weight = float(ps_prod['weight'])
                        if weight > 0:
                            updates['weight'] = weight
                    except (ValueError, TypeError):
                        pass
                
                # Imagen
                if not product.get('image_url') and ps_prod.get('id_default_image'):
                    image_id = ps_prod['id_default_image']
                    if int(image_id) > 0:
                        shop_url = integ['shop_url']
                        updates['image_url'] = f"{shop_url}/api/images/products/{ps_id}/{image_id}"
                
                # Actualizar si hay cambios
                if updates:
                    await db.products.update_one(
                        {'id': product['id']},
                        {'$set': updates}
                    )
                    updated_count += 1
                    
                    if updated_count % 50 == 0:
                        print(f'  Actualizados: {updated_count}/{len(products)}')
                
            except Exception as e:
                print(f'  Error con producto {product.get("name", "")[:30]}: {e}')
                continue
        
        print(f'\n✓ Actualizados: {updated_count}')
        print(f'✓ Ya completos: {skipped_count}')
    
    print('\n=== ACTUALIZACIÓN COMPLETADA ===')

if __name__ == '__main__':
    asyncio.run(update_products())
