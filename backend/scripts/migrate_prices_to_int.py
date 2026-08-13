"""
Script para migrar precios de float a int en todos los productos
Convierte cost_price, sale_price y last_price a números enteros
"""
import asyncio
import sys
sys.path.insert(0, '/app/backend')
from utils import db

async def migrate_prices():
    print('=== MIGRACIÓN DE PRECIOS A ENTEROS ===\n')
    
    # Obtener todos los productos
    products = await db.products.find({}, {'_id': 0}).to_list(10000)
    
    print(f'Total productos encontrados: {len(products)}\n')
    
    updated_count = 0
    
    for product in products:
        product_id = product.get('id')
        updates = {}
        
        # Convertir cost_price
        if 'cost_price' in product and product['cost_price'] is not None:
            if isinstance(product['cost_price'], float):
                updates['cost_price'] = int(round(product['cost_price']))
        
        # Convertir sale_price
        if 'sale_price' in product and product['sale_price'] is not None:
            if isinstance(product['sale_price'], float):
                updates['sale_price'] = int(round(product['sale_price']))
        
        # Convertir last_price
        if 'last_price' in product and product['last_price'] is not None:
            if isinstance(product['last_price'], float):
                updates['last_price'] = int(round(product['last_price']))
        
        # Convertir precios en combinations
        if 'combinations' in product and product['combinations']:
            new_combinations = []
            for comb in product['combinations']:
                if 'price' in comb and isinstance(comb.get('price'), float):
                    comb['price'] = int(round(comb['price']))
                new_combinations.append(comb)
            if new_combinations:
                updates['combinations'] = new_combinations
        
        # Actualizar si hay cambios
        if updates:
            await db.products.update_one(
                {'id': product_id},
                {'$set': updates}
            )
            updated_count += 1
            print(f'✓ Producto actualizado: {product.get("name", "")[:50]} (ID: {product_id})')
    
    print(f'\n=== MIGRACIÓN COMPLETADA ===')
    print(f'Total productos actualizados: {updated_count}/{len(products)}')

if __name__ == '__main__':
    asyncio.run(migrate_prices())
