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

# Mapeo de estados de PrestaShop (1 = activo, 0 = inactivo)
PRESTASHOP_STATE_MAP = {
    "1": "Esperando pago con cheque",
    "2": "Pago aceptado",
    "3": "Preparación en curso",
    "4": "Enviado",
    "5": "Entregado",
    "6": "Cancelado",
    "7": "Reembolsado",
    "8": "Error de pago",
    "10": "Esperando transferencia bancaria",
    "12": "Pago remoto aceptado",
}

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
    # Agregar timestamp de actualización para sincronización bidireccional
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
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
    Sincronización bidireccional automática de stock con PrestaShop
    - Compara stock local vs PrestaShop
    - Actualiza automáticamente en ambas direcciones basado en última modificación
    - Sincronización bidireccional completa
    """
    try:
        # Obtener integraciones activas de PrestaShop
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        integrations = await db.prestashop_integrations.find(tenant_filter, {'_id': 0}).to_list(100)
        
        if not integrations:
            return {
                'success': False,
                'message': 'No hay integraciones de PrestaShop configuradas',
                'synced_count': 0,
                'synced_to_prestashop': 0,
                'synced_from_prestashop': 0
            }
        
        synced_from_ps = 0
        synced_to_ps = 0
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
                
                # Crear mapeo SKU -> PrestaShop data
                ps_stock_map = {}
                ps_id_map = {}
                
                for ps_product in ps_products:
                    sku = ps_product.get('reference', '')
                    if sku:
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
                    {'_id': 0, 'id': 1, 'sku': 1, 'name': 1, 'stock': 1, 'last_stock_sync': 1, 'updated_at': 1}
                ).to_list(10000)
                
                # Sincronización bidireccional inteligente
                for product in local_products:
                    sku = product.get('sku')
                    if not sku or sku not in ps_stock_map:
                        continue
                    
                    local_stock = int(product.get('stock', 0))
                    ps_stock = ps_stock_map[sku]
                    ps_product_id = ps_id_map[sku]
                    
                    # Si el stock es diferente
                    if local_stock != ps_stock:
                        # Determinar qué versión es más reciente
                        last_sync = product.get('last_stock_sync')
                        updated_at = product.get('updated_at')
                        
                        # Si nunca se ha sincronizado, usar PrestaShop como fuente de verdad
                        if not last_sync:
                            # Actualizar local desde PrestaShop
                            await db.products.update_one(
                                {'id': product['id']},
                                {'$set': {
                                    'stock': ps_stock,
                                    'last_stock_sync': datetime.now(timezone.utc).isoformat()
                                }}
                            )
                            synced_from_ps += 1
                        else:
                            # Si se ha modificado localmente después de la última sincronización
                            # Actualizar PrestaShop con el stock local
                            if updated_at and last_sync and updated_at > last_sync:
                                # El stock local es más reciente, actualizar PrestaShop
                                success = ps_service.update_stock(ps_product_id, local_stock)
                                if success:
                                    await db.products.update_one(
                                        {'id': product['id']},
                                        {'$set': {
                                            'last_stock_sync': datetime.now(timezone.utc).isoformat()
                                        }}
                                    )
                                    synced_to_ps += 1
                                else:
                                    errors.append(f"Error actualizando stock de {product.get('name')} en PrestaShop")
                            else:
                                # PrestaShop es más reciente, actualizar local
                                await db.products.update_one(
                                    {'id': product['id']},
                                    {'$set': {
                                        'stock': ps_stock,
                                        'last_stock_sync': datetime.now(timezone.utc).isoformat()
                                    }}
                                )
                                synced_from_ps += 1
            
            except Exception as e:
                errors.append(f"{integration.get('store_name', 'Unknown')}: {str(e)}")
        
        total_synced = synced_from_ps + synced_to_ps
        
        return {
            'success': True,
            'message': f'Stock sincronizado: {synced_from_ps} desde PrestaShop, {synced_to_ps} hacia PrestaShop',
            'synced_count': total_synced,
            'synced_from_prestashop': synced_from_ps,
            'synced_to_prestashop': synced_to_ps,
            'errors': errors if errors else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sincronizando stock: {str(e)}"
        )



@router.patch("/{product_id}/ecommerce-publication")
async def toggle_ecommerce_publication(
    product_id: str,
    active: bool,
    current_user: User = Depends(get_current_user)
):
    """
    Activar/desactivar publicación de producto en ecommerce (PrestaShop)
    Respeta el aislamiento multi-tenant usando solo la integración del producto
    """
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {"id": product_id})
        
        # Obtener producto
        product = await db.products.find_one(tenant_filter, {"_id": 0})
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado"
            )
        
        # Verificar que el producto tiene integración de PrestaShop
        prestashop_product_id = product.get('prestashop_id')
        integration_id = product.get('prestashop_integration_id')
        
        if not prestashop_product_id or not integration_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este producto no está vinculado a ninguna integración de ecommerce"
            )
        
        # Obtener SOLO la integración específica del producto (aislamiento de datos)
        integration = await db.prestashop_integrations.find_one({
            "account_id": current_user.account_id,
            "id": integration_id,
            "is_active": True
        }, {"_id": 0})
        
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La integración de ecommerce de este producto no está activa"
            )
        
        # Actualizar estado en MongoDB
        now = datetime.now(timezone.utc)
        update_data = {
            "ecommerce_active": active,
            "ecommerce_last_updated": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.products.update_one(
            tenant_filter,
            {"$set": update_data}
        )
        
        # Sincronizar con PrestaShop de la tienda específica
        sync_error = None
        sync_success = False
        
        try:
            from services.prestashop_service import PrestashopAPIService
            
            # Crear servicio de PrestaShop para esta integración específica
            ps_service = PrestashopAPIService(
                shop_url=integration['shop_url'],
                api_key=integration['api_key']
            )
            
            # Actualizar estado en PrestaShop
            sync_success = ps_service.update_product_active(
                product_id=int(prestashop_product_id),
                active=active
            )
            
        except Exception as e:
            sync_error = str(e)
        
        return {
            "success": True,
            "product_id": product_id,
            "ecommerce_active": active,
            "prestashop_synced": sync_success,
            "sync_error": sync_error,
            "message": f"Producto {'activado' if active else 'desactivado'} en ecommerce"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar publicación: {str(e)}"
        )

@router.post("/{product_id}/ecommerce-publication/pull")
async def pull_ecommerce_publication(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar estado de publicación desde PrestaShop hacia la aplicación
    """
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {"id": product_id})
        
        # Obtener producto
        product = await db.products.find_one(tenant_filter, {"_id": 0})
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado"
            )
        
        # Verificar si hay integraciones PrestaShop activas
        integrations_cursor = db.prestashop_integrations.find({
            "account_id": current_user.account_id,
            "is_active": True
        }, {"_id": 0})
        integrations = await integrations_cursor.to_list(100)
        
        if not integrations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay integraciones de ecommerce activas"
            )
        
        # Obtener estado desde PrestaShop
        sync_results = []
        
        for integration in integrations:
            try:
                # Verificar si el producto está vinculado a esta integración
                prestashop_key = f"prestashop_product_id_{integration.get('id')}"
                prestashop_product_id = product.get(prestashop_key) or product.get('prestashop_product_id')
                
                if prestashop_product_id:
                    from services.prestashop_service import PrestashopAPIService
                    
                    # Crear servicio de PrestaShop
                    ps_service = PrestashopAPIService(
                        shop_url=integration['shop_url'],
                        api_key=integration['api_key']
                    )
                    
                    # Obtener producto de PrestaShop
                    ps_product = ps_service.get_product(int(prestashop_product_id))
                    
                    # Extraer estado activo
                    product_data = ps_product.get('product', ps_product)
                    remote_active = bool(int(product_data.get('active', 0)))
                    
                    sync_results.append({
                        "store": integration.get('store_name'),
                        "active": remote_active
                    })
            
            except Exception as e:
                sync_results.append({
                    "store": integration.get('store_name'),
                    "error": str(e)
                })
        
        # Si hay resultados exitosos, tomar el primero como fuente de verdad
        successful_syncs = [r for r in sync_results if 'active' in r]
        
        if successful_syncs:
            remote_active = successful_syncs[0]['active']
            
            # Actualizar estado en MongoDB
            now = datetime.now(timezone.utc)
            await db.products.update_one(
                tenant_filter,
                {"$set": {
                    "ecommerce_active": remote_active,
                    "ecommerce_last_synced": now.isoformat(),
                    "ecommerce_sync_source": "prestashop",
                    "updated_at": now.isoformat()
                }}
            )
            
            return {
                "success": True,
                "product_id": product_id,
                "ecommerce_active": remote_active,
                "sync_results": sync_results,
                "message": "Estado sincronizado desde PrestaShop"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo sincronizar con ninguna tienda PrestaShop"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al sincronizar desde PrestaShop: {str(e)}"
        )


