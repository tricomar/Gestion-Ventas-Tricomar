"""
Router para gestión de productos e inventario
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import bcrypt

from models.products import Product, ProductBase, ProductCreate
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from utils import db, get_current_user, require_admin
from models.users import User

router = APIRouter(prefix="/products", tags=["products"])

@router.get("", response_model=List[Product])
async def get_products(current_user: User = Depends(get_current_user)):
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict())
    products = await db.products.find(tenant_filter, {'_id': 0}).sort('name', 1).to_list(10000)
    
    result = []
    for prod in products:
        if isinstance(prod.get('created_at'), str):
            prod['created_at'] = datetime.fromisoformat(prod['created_at'])
        
        # Generate and save 'id' if missing (legacy products)
        if 'id' not in prod:
            prod['id'] = str(uuid.uuid4())
            # Update the document with the new id
            await db.products.update_one(
                {'name': prod['name']},
                {'$set': {'id': prod['id']}}
            )
        
        # Backfill legacy products with defaults
        if 'store' not in prod:
            prod['store'] = 'A'
        if 'cost_price' not in prod:
            prod['cost_price'] = prod.get('last_price', 0) * 0.6 if prod.get('last_price') else 0
        if 'sale_price' not in prod:
            prod['sale_price'] = prod.get('last_price', 0)
        if 'usage_count' not in prod:
            prod['usage_count'] = 0
        
        # Fix brand field if it's not a string (could be False from old data)
        if 'brand' in prod and not isinstance(prod['brand'], str):
            prod['brand'] = None
            
        # Update legacy product in DB
        if 'last_price' in prod and ('store' not in prod or 'cost_price' not in prod):
            await db.products.update_one(
                {'id': prod['id']},
                {'$set': {
                    'store': prod['store'],
                    'cost_price': prod['cost_price'],
                    'sale_price': prod['sale_price']
                }}
            )
        
        try:
            result.append(Product(**prod))
        except Exception as e:
            print(f"Error parsing product {prod.get('id', 'unknown')}: {str(e)}")
            # Skip malformed products but continue
            continue
    
    return result

@router.get("/search")
async def search_products(q: str, current_user: User = Depends(get_current_user)):
    # CRITICAL: Aplicar filtro de tenant para aislamiento multi-tenant
    tenant_filter = get_tenant_filter(current_user.dict())
    
    # Buscar por nombre O por SKU
    tenant_filter['$or'] = [
        {'name': {'$regex': q, '$options': 'i'}},
        {'sku': {'$regex': q, '$options': 'i'}}
    ]
    
    products = await db.products.find(
        tenant_filter,
        {'_id': 0}
    ).sort('usage_count', -1).limit(10).to_list(10)
    
    # Redondear precios
    for product in products:
        if 'sale_price' in product:
            product['sale_price'] = round(product['sale_price'])
        if 'cost_price' in product:
            product['cost_price'] = round(product['cost_price'])
    
    return products

@router.get("/top-selling")
async def get_top_selling_products(limit: int = 20, current_user: User = Depends(get_current_user)):
    """Obtener productos más vendidos (basado en usage_count)"""
    tenant_filter = get_tenant_filter(current_user.dict())
    
    products = await db.products.find(
        tenant_filter,
        {'_id': 0}
    ).sort('usage_count', -1).limit(limit).to_list(limit)
    
    # Redondear precios y asegurar campos
    for product in products:
        if 'sale_price' in product:
            product['sale_price'] = round(product['sale_price'])
        if 'cost_price' in product:
            product['cost_price'] = round(product['cost_price'])
        if 'usage_count' not in product:
            product['usage_count'] = 0
        # Fix brand field if it's not a string
        if 'brand' in product and not isinstance(product['brand'], str):
            product['brand'] = None
    
    return products

@router.post("", response_model=Product)
async def create_product(product_input: ProductCreate, current_user: User = Depends(get_current_user)):
    # Check if product exists
    existing = await db.products.find_one({'name': product_input.name}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Product already exists")
    
    # Create new product
    product = Product(**product_input.model_dump(), usage_count=0)
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    # Agregar account_id (tenant isolation)
    doc = add_account_id_to_document(current_user.dict(), doc)

    await db.products.insert_one(doc)
    
    return product

@router.put("/{product_id}", response_model=Product)
async def update_product(product_id: str, product_input: ProductCreate, current_user: User = Depends(get_current_user)):
    existing = await db.products.find_one(get_tenant_filter(current_user.dict(), {'id': product_id}), {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_input.model_dump()
    await db.products.update_one(get_tenant_filter(current_user.dict(), {'id': product_id}), {'$set': update_data})
    
    updated = await db.products.find_one(get_tenant_filter(current_user.dict(), {'id': product_id}), {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Product(**updated)

@router.delete("/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    result = await db.products.delete_one(get_tenant_filter(current_user.dict(), {'id': product_id}))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@router.get("/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one(get_tenant_filter(current_user.dict(), {'id': product_id}), {'_id': 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)


@router.post("/sync-stock")
async def sync_stock_bidirectional(current_user: User = Depends(get_current_user)):
    """
    Sincronización bidireccional rápida de stock con PrestaShop
    - Obtiene stock actual de PrestaShop
    - Compara con stock local
    - Actualiza en ambas direcciones según sea necesario
    """
    try:
        # Obtener integraciones activas de PrestaShop
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        integrations = await db.prestashop_integrations.find(tenant_filter, {'_id': 0}).to_list(100)
        
        if not integrations:
            return {
                'success': False,
                'message': 'No hay integraciones de PrestaShop configuradas',
                'synced_count': 0
            }
        
        synced_count = 0
        errors = []
        
        for integration in integrations:
            try:
                from services.prestashop_service import PrestashopService
                
                ps_service = PrestashopService(
                    api_url=integration['api_url'],
                    api_key=integration['api_key']
                )
                
                # Obtener productos de PrestaShop con stock
                ps_products = ps_service.get_products_with_brands(limit=1000)
                
                # Crear mapeo SKU -> PrestaShop stock
                ps_stock_map = {}
                ps_id_map = {}  # Mapeo de ID de PrestaShop
                
                for ps_product in ps_products:
                    sku = ps_product.get('reference', '')
                    if sku:
                        # El stock en PrestaShop puede venir en diferentes formatos
                        stock_available = ps_product.get('quantity', 0)
                        if isinstance(stock_available, dict):
                            stock_available = int(stock_available.get('quantity', 0))
                        else:
                            stock_available = int(stock_available) if stock_available else 0
                        
                        ps_stock_map[sku] = stock_available
                        ps_id_map[sku] = ps_product.get('id')
                
                # Obtener productos locales
                local_products = await db.products.find(
                    tenant_filter,
                    {'_id': 0, 'id': 1, 'sku': 1, 'name': 1, 'stock': 1}
                ).to_list(10000)
                
                # Sincronizar stock
                for product in local_products:
                    sku = product.get('sku')
                    if not sku or sku not in ps_stock_map:
                        continue
                    
                    local_stock = product.get('stock', 0)
                    ps_stock = ps_stock_map[sku]
                    
                    # Si hay diferencia, actualizar en la base de datos local
                    if local_stock != ps_stock:
                        await db.products.update_one(
                            {'id': product['id']},
                            {'$set': {
                                'stock': ps_stock,
                                'last_stock_sync': datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        synced_count += 1
                        
                        # Opcional: También actualizar en PrestaShop si el stock local es más reciente
                        # (esto requiere una lógica más sofisticada basada en timestamps)
            
            except Exception as e:
                errors.append(f"{integration.get('store_name', 'Unknown')}: {str(e)}")
        
        return {
            'success': True,
            'message': f'Stock sincronizado correctamente',
            'synced_count': synced_count,
            'errors': errors if errors else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sincronizando stock: {str(e)}"
        )

