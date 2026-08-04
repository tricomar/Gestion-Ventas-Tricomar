"""
Router para integraciones con plataformas ecommerce (PrestaShop, WooCommerce, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Body
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from pydantic import BaseModel
import asyncio

from models.integrations import (
    PrestashopIntegration,
    PrestashopProduct,
    PrestashopCategory,
    StockConflict,
    SyncLog
)
from services.prestashop_service import PrestashopAPIService
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from utils import db, get_current_user
from models.users import User

router = APIRouter(prefix="/integrations", tags=["integrations"])


class PrestashopConnectRequest(BaseModel):
    shop_url: str
    api_key: str
    store_id: str


@router.post("/prestashop/connect")
async def connect_prestashop(
    request: PrestashopConnectRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Conectar una nueva integración con PrestaShop
    """
    # Verificar que la tienda pertenece al usuario
    # Primero intentar buscar en account
    account = await db.accounts.find_one({'_id': current_user.account_id}, {'_id': 0})
    
    print(f"[DEBUG] account_id: {current_user.account_id}")
    print(f"[DEBUG] account found: {account is not None}")
    
    stores = []
    selected_store = None
    
    if account and 'stores' in account and account['stores']:
        # Buscar en account.stores (nuevo sistema)
        stores = account['stores']
        print(f"[DEBUG] Using account stores: {len(stores)} stores")
        selected_store = next((s for s in stores if s['id'] == request.store_id), None)
    
    if not selected_store:
        # Fallback: buscar en settings (sistema legacy)
        settings = await db.settings.find_one(get_tenant_filter(current_user.dict(), {}), {'_id': 0})
        print(f"[DEBUG] settings found: {settings is not None}")
        if settings:
            # Generar stores legacy
            stores = [
                {'id': 'store_a', 'name': settings.get('store_a_name', 'Tienda A'), 'code': 'A'},
                {'id': 'store_b', 'name': settings.get('store_b_name', 'Tienda B'), 'code': 'B'}
            ]
            print(f"[DEBUG] Using legacy stores: {stores}")
            print(f"[DEBUG] Looking for store_id: {request.store_id}")
            selected_store = next((s for s in stores if s['id'] == request.store_id), None)
            print(f"[DEBUG] selected_store: {selected_store}")
    
    if not selected_store:
        print(f"[DEBUG] No store found for store_id: {request.store_id}")
        raise HTTPException(status_code=404, detail="Tienda/Caja no encontrada")
    
    # Probar conexión con PrestaShop
    try:
        ps_service = PrestashopAPIService(request.shop_url, request.api_key)
        if not ps_service.test_connection():
            raise HTTPException(status_code=400, detail="No se pudo conectar con PrestaShop. Verifica la URL y API Key")
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Mensajes de error más específicos
        if "SSL" in error_msg or "certificate" in error_msg.lower():
            raise HTTPException(status_code=400, detail=f"Error de certificado SSL. La URL debe ser HTTPS válida.")
        elif "Timeout" in error_msg or "timeout" in error_msg.lower():
            raise HTTPException(status_code=400, detail=f"El servidor no responde. Verifica que la URL sea correcta.")
        elif "401" in error_msg or "Autenticación" in error_msg:
            raise HTTPException(status_code=400, detail=f"API Key incorrecta. Verifica tu clave de acceso.")
        elif "404" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(status_code=400, detail=f"URL incorrecta. Debe ser algo como: https://tu-tienda.com")
        else:
            raise HTTPException(status_code=400, detail=f"Error al conectar: {error_msg}")
    
    # Verificar si ya existe una integración para esta tienda
    existing = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'store_id': request.store_id}),
        {'_id': 0}
    )
    
    if existing:
        # Actualizar existente
        await db.prestashop_integrations.update_one(
            get_tenant_filter(current_user.dict(), {'store_id': request.store_id}),
            {
                '$set': {
                    'shop_url': request.shop_url,
                    'api_key': request.api_key,
                    'is_active': True,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        integration_id = existing['id']
    else:
        # Crear nueva integración
        integration = {
            'id': str(uuid4()),
            'account_id': current_user.account_id,
            'store_id': request.store_id,
            'store_name': selected_store['name'],
            'shop_url': request.shop_url,
            'api_key': request.api_key,
            'is_active': True,
            'last_sync_products': None,
            'last_sync_categories': None,
            'last_sync_stock': None,
            'sync_interval_minutes': 15,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.prestashop_integrations.insert_one(integration)
        integration_id = integration['id']
    
    # Crear log de conexión exitosa
    log = {
        'id': str(uuid4()),
        'account_id': current_user.account_id,
        'integration_id': integration_id,
        'sync_type': 'connection',
        'status': 'success',
        'message': 'Conexión establecida exitosamente',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sync_logs.insert_one(log)
    
    return {
        'success': True,
        'integration_id': integration_id,
        'message': 'Conexión establecida exitosamente'
    }


@router.get("/prestashop/list")
async def list_prestashop_integrations(current_user: User = Depends(get_current_user)):
    """
    Listar todas las integraciones de PrestaShop
    """
    integrations = await db.prestashop_integrations.find(
        get_tenant_filter(current_user.dict(), {}),
        {'_id': 0, 'api_key': 0}  # No devolver API key
    ).to_list(100)
    
    return integrations


@router.post("/prestashop/{integration_id}/sync-categories")
async def sync_categories(
    integration_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar categorías desde PrestaShop
    """
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear servicio de PrestaShop
    ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
    
    try:
        # Obtener categorías de PrestaShop
        ps_categories = ps_service.get_categories(limit=200)
        
        synced_count = 0
        for ps_cat in ps_categories:
            cat_id = int(ps_cat.get('id', 0))
            if cat_id <= 0:
                continue
            
            # Buscar si ya existe
            existing = await db.prestashop_categories.find_one(
                get_tenant_filter(current_user.dict(), {
                    'integration_id': integration_id,
                    'prestashop_id': cat_id
                }),
                {'_id': 0}
            )
            
            category_doc = {
                'account_id': current_user.account_id,
                'integration_id': integration_id,
                'prestashop_id': cat_id,
                'name': ps_cat.get('name', {}).get('language', {}).get('value', f'Categoría {cat_id}') if isinstance(ps_cat.get('name'), dict) else ps_cat.get('name', f'Categoría {cat_id}'),
                'parent_id': int(ps_cat.get('id_parent', 0)),
                'active': ps_cat.get('active', '1') == '1'
            }
            
            if existing:
                # Actualizar
                await db.prestashop_categories.update_one(
                    get_tenant_filter(current_user.dict(), {
                        'integration_id': integration_id,
                        'prestashop_id': cat_id
                    }),
                    {'$set': category_doc}
                )
            else:
                # Crear
                category_doc['id'] = str(uuid4())
                category_doc['created_at'] = datetime.now(timezone.utc).isoformat()
                await db.prestashop_categories.insert_one(category_doc)
            
            synced_count += 1
        
        # Actualizar última sincronización
        await db.prestashop_integrations.update_one(
            get_tenant_filter(current_user.dict(), {'id': integration_id}),
            {'$set': {'last_sync_categories': datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log
        log = {
            'id': str(uuid4()),
            'account_id': current_user.account_id,
            'integration_id': integration_id,
            'sync_type': 'categories',
            'status': 'success',
            'message': f'{synced_count} categorías sincronizadas',
            'details': {'count': synced_count},
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.sync_logs.insert_one(log)
        
        return {
            'success': True,
            'synced_count': synced_count,
            'message': f'{synced_count} categorías sincronizadas exitosamente'
        }
        
    except Exception as e:
        # Log error
        log = {
            'id': str(uuid4()),
            'account_id': current_user.account_id,
            'integration_id': integration_id,
            'sync_type': 'categories',
            'status': 'error',
            'message': str(e),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.sync_logs.insert_one(log)
        
        raise HTTPException(status_code=500, detail=f"Error al sincronizar categorías: {str(e)}")


@router.post("/prestashop/{integration_id}/sync-products")
async def sync_products(
    integration_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar productos desde PrestaShop
    """
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear servicio de PrestaShop
    ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
    
    try:
        # Obtener productos de PrestaShop
        ps_products = ps_service.get_products(limit=500)
        
        synced_count = 0
        for ps_prod in ps_products:
            prod_id = int(ps_prod.get('id', 0))
            if prod_id <= 0:
                continue
            
            # Obtener nombre del producto
            name = ps_prod.get('name', {})
            if isinstance(name, dict):
                name = name.get('language', {}).get('value', f'Producto {prod_id}')
            elif not name:
                name = f'Producto {prod_id}'
            
            # Obtener SKU (reference en PrestaShop)
            sku = ps_prod.get('reference', '')
            sku_generated = False
            if not sku:
                # Generar SKU automático único
                sku = f"PS-{prod_id}-{str(uuid4())[:8]}"
                sku_generated = True
                
                # Actualizar SKU en PrestaShop también
                try:
                    ps_service.update_product_reference(prod_id, sku)
                except Exception as e:
                    print(f"Error actualizando SKU en PrestaShop para producto {prod_id}: {str(e)}")
            
            # Obtener precio
            price = float(ps_prod.get('price', 0))
            
            # Obtener stock
            stock = ps_service.get_product_stock(prod_id)
            if stock is None:
                stock = 0
            
            # Buscar si ya existe
            existing = await db.prestashop_products.find_one(
                get_tenant_filter(current_user.dict(), {
                    'integration_id': integration_id,
                    'prestashop_id': prod_id
                }),
                {'_id': 0}
            )
            
            product_doc = {
                'account_id': current_user.account_id,
                'integration_id': integration_id,
                'prestashop_id': prod_id,
                'name': name,
                'sku': sku,
                'price': price,
                'stock_quantity': stock,
                'category_id': int(ps_prod.get('id_category_default', 0)),
                'active': ps_prod.get('active', '1') == '1',
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            if existing:
                # Actualizar
                await db.prestashop_products.update_one(
                    get_tenant_filter(current_user.dict(), {
                        'integration_id': integration_id,
                        'prestashop_id': prod_id
                    }),
                    {'$set': product_doc}
                )
            else:
                # Crear
                product_doc['id'] = str(uuid4())
                product_doc['created_at'] = datetime.now(timezone.utc).isoformat()
                await db.prestashop_products.insert_one(product_doc)
            
            synced_count += 1
        
        # Actualizar última sincronización
        await db.prestashop_integrations.update_one(
            get_tenant_filter(current_user.dict(), {'id': integration_id}),
            {'$set': {'last_sync_products': datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log
        log = {
            'id': str(uuid4()),
            'account_id': current_user.account_id,
            'integration_id': integration_id,
            'sync_type': 'products',
            'status': 'success',
            'message': f'{synced_count} productos sincronizados',
            'details': {'count': synced_count},
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.sync_logs.insert_one(log)
        
        return {
            'success': True,
            'synced_count': synced_count,
            'message': f'{synced_count} productos sincronizados exitosamente'
        }
        
    except Exception as e:
        # Log error
        log = {
            'id': str(uuid4()),
            'account_id': current_user.account_id,
            'integration_id': integration_id,
            'sync_type': 'products',
            'status': 'error',
            'message': str(e),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.sync_logs.insert_one(log)
        
        raise HTTPException(status_code=500, detail=f"Error al sincronizar productos: {str(e)}")


@router.get("/prestashop/{integration_id}/products")
async def get_prestashop_products(
    integration_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener productos sincronizados de PrestaShop
    """
    products = await db.prestashop_products.find(
        get_tenant_filter(current_user.dict(), {'integration_id': integration_id}),
        {'_id': 0}
    ).to_list(1000)
    
    return products


@router.delete("/prestashop/{integration_id}")
async def delete_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Eliminar integración de PrestaShop
    """
    result = await db.prestashop_integrations.delete_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id})
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Eliminar productos y categorías asociadas
    await db.prestashop_products.delete_many(
        get_tenant_filter(current_user.dict(), {'integration_id': integration_id})
    )
    await db.prestashop_categories.delete_many(
        get_tenant_filter(current_user.dict(), {'integration_id': integration_id})
    )
    
    return {'success': True, 'message': 'Integración eliminada exitosamente'}
