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
    account = await db.accounts.find_one({'id': current_user.account_id}, {'_id': 0})
    
    stores = []
    selected_store = None
    
    if account and 'stores' in account and account['stores']:
        # Buscar en account.stores (nuevo sistema)
        stores = account['stores']
        selected_store = next((s for s in stores if s['id'] == request.store_id), None)
    
    if not selected_store:
        # Fallback: buscar en settings (sistema legacy)
        settings = await db.settings.find_one(get_tenant_filter(current_user.dict(), {}), {'_id': 0})
        if settings:
            # Generar stores legacy
            stores = [
                {'id': 'store_a', 'name': settings.get('store_a_name', 'Tienda A'), 'code': 'A'},
                {'id': 'store_b', 'name': settings.get('store_b_name', 'Tienda B'), 'code': 'B'}
            ]
            selected_store = next((s for s in stores if s['id'] == request.store_id), None)
    
    # Si aún no existe, CREAR LA TIENDA AUTOMÁTICAMENTE
    if not selected_store:
        # Extraer nombre de tienda de la URL de PrestaShop
        store_name = request.shop_url.replace('https://', '').replace('http://', '').split('/')[0]
        store_name = store_name.replace('.com', '').replace('.cl', '').replace('.', ' ').title()
        
        # Generar código único
        existing_codes = []
        if account and 'stores' in account:
            existing_codes = [s.get('code', '') for s in account['stores']]
        
        base_code = store_name[0].upper() if store_name else 'S'
        code = base_code
        counter = 1
        while code in existing_codes:
            code = f"{base_code}{counter}"
            counter += 1
        
        # Crear nueva tienda
        new_store = {
            'id': request.store_id,
            'name': store_name,
            'code': code,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'source': 'prestashop'
        }
        
        # Agregar a la cuenta
        if account:
            if 'stores' not in account:
                account['stores'] = []
            
            await db.accounts.update_one(
                {'id': current_user.account_id},
                {'$push': {'stores': new_store}}
            )
        else:
            # Crear account si no existe
            new_account = {
                'id': current_user.account_id,
                'stores': [new_store],
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            await db.accounts.insert_one(new_account)
        
        selected_store = new_store
        print(f"✓ Auto-created store: {new_store['name']} (code: {new_store['code']})")
    
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
        
        # SINCRONIZAR CATEGORÍAS A SETTINGS LOCAL
        # Obtener todas las categorías sincronizadas
        all_categories = await db.prestashop_categories.find(
            {'account_id': current_user.account_id, 'integration_id': integration_id, 'active': True},
            {'_id': 0}
        ).to_list(1000)
        
        # Extraer nombres de categorías
        category_names = [cat.get('name') for cat in all_categories if cat.get('name')]
        
        if category_names:
            # Obtener settings actuales
            settings = await db.settings.find_one(
                get_tenant_filter(current_user.dict(), {}),
                {'_id': 0}
            )
            
            if settings:
                # Combinar categorías existentes con las nuevas (sin duplicados)
                existing_categories = settings.get('product_categories', [])
                combined_categories = list(set(existing_categories + category_names))
                
                # Actualizar settings con categorías combinadas
                await db.settings.update_one(
                    get_tenant_filter(current_user.dict(), {}),
                    {'$set': {'product_categories': combined_categories}}
                )
        
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
    Iniciar sincronización de productos en background
    """
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear job de sincronización
    job_id = str(uuid4())
    job = {
        'id': job_id,
        'account_id': current_user.account_id,
        'integration_id': integration_id,
        'type': 'sync_products',
        'status': 'running',
        'progress': 0,
        'total': 0,
        'message': 'Iniciando sincronización...',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sync_jobs.insert_one(job)
    
    # Ejecutar sincronización en background
    background_tasks.add_task(
        sync_products_background,
        job_id,
        integration_id,
        integration,
        current_user.account_id
    )
    
    return {
        'success': True,
        'job_id': job_id,
        'message': 'Sincronización iniciada'
    }


async def sync_products_background(job_id: str, integration_id: str, integration: dict, account_id: str):
    """
    Sincronizar productos en background
    """
    try:
        # Crear servicio de PrestaShop
        ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
        
        # Actualizar job
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {'status': 'running', 'message': 'Obteniendo productos de PrestaShop...'}}
        )
        
        # Obtener productos de PrestaShop
        ps_products = ps_service.get_products(limit=500)
        total = len(ps_products)
        
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {'total': total, 'message': f'Sincronizando {total} productos...'}}
        )
        
        synced_count = 0
        for idx, ps_prod in enumerate(ps_products, 1):
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
            
            # Obtener precios de PrestaShop
            price_without_tax = float(ps_prod.get('price', 0))  # Precio sin IVA
            wholesale_price = float(ps_prod.get('wholesale_price', 0))  # Precio de compra/coste
            tax_rate = float(ps_prod.get('tax_rate', 0)) / 100  # Tasa de impuesto (viene como porcentaje)
            
            # Calcular precio con IVA
            price_with_tax = price_without_tax * (1 + tax_rate)
            
            # Según requerimiento del usuario: el costo local debe basarse en el precio CON IVA
            cost_price = price_with_tax
            sale_price = price_with_tax  # Precio de venta con IVA
            
            # Obtener stock
            stock = ps_service.get_product_stock(prod_id)
            if stock is None:
                stock = 0
            
            # Buscar si ya existe
            existing = await db.prestashop_products.find_one(
                {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': prod_id},
                {'_id': 0}
            )
            
            product_doc = {
                'account_id': account_id,
                'integration_id': integration_id,
                'prestashop_id': prod_id,
                'name': name,
                'sku': sku,
                'price_without_tax': price_without_tax,
                'price_with_tax': price_with_tax,
                'wholesale_price': wholesale_price,
                'cost_price': cost_price,  # Precio con IVA como costo (según requerimiento)
                'sale_price': sale_price,  # Precio de venta con IVA
                'tax_rate': tax_rate * 100,  # Guardar como porcentaje
                'stock_quantity': stock,
                'category_id': int(ps_prod.get('id_category_default', 0)),
                'active': ps_prod.get('active', '1') == '1',
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            if existing:
                await db.prestashop_products.update_one(
                    {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': prod_id},
                    {'$set': product_doc}
                )
            else:
                product_doc['id'] = str(uuid4())
                product_doc['created_at'] = datetime.now(timezone.utc).isoformat()
                await db.prestashop_products.insert_one(product_doc)
            
            # IMPORTAR AUTOMÁTICAMENTE A LA COLECCIÓN LOCAL DE PRODUCTOS
            # Buscar si ya existe en la colección local (buscar por SKU)
            local_product = await db.products.find_one(
                {'account_id': account_id, 'sku': sku},
                {'_id': 0}
            )
            
            # Obtener el código correcto de la tienda desde la cuenta
            account = await db.accounts.find_one({'id': account_id}, {'_id': 0})
            store_code = 'A'  # Valor por defecto
            if account and 'stores' in account:
                # Buscar la tienda asociada a esta integración
                store_id = integration.get('store_id')
                matching_store = next((s for s in account['stores'] if s.get('id') == store_id), None)
                if matching_store:
                    store_code = matching_store.get('code', 'A')
            
            # Obtener nombre de categoría de PrestaShop
            category_id = int(ps_prod.get('id_category_default', 0))
            category_name = 'Sin categoría'
            if category_id > 0:
                ps_category = await db.prestashop_categories.find_one(
                    {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': category_id},
                    {'_id': 0}
                )
                if ps_category:
                    category_name = ps_category.get('name', 'Sin categoría')
            
            # Preparar documento para colección local
            local_product_doc = {
                'account_id': account_id,
                'name': name,
                'sku': sku,
                'cost_price': cost_price,  # COSTO = Precio CON IVA de PrestaShop
                'sale_price': sale_price,  # Precio de venta CON IVA
                'stock': stock,
                'category': category_name,  # Categoría desde PrestaShop
                'store': store_code,  # Código correcto de la tienda
                'min_stock': 5,  # Valor por defecto
                'prestashop_id': prod_id,  # Referencia al producto de PrestaShop
                'prestashop_integration_id': integration_id,  # Referencia a la integración
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            if local_product:
                # Actualizar producto existente
                await db.products.update_one(
                    {'account_id': account_id, 'sku': sku},
                    {'$set': local_product_doc}
                )
            else:
                # Crear nuevo producto en colección local
                local_product_doc['id'] = str(uuid4())
                local_product_doc['created_at'] = datetime.now(timezone.utc).isoformat()
                await db.products.insert_one(local_product_doc)
            
            synced_count += 1
            
            # Actualizar progreso cada 10 productos
            if idx % 10 == 0 or idx == total:
                progress = int((idx / total) * 100)
                await db.sync_jobs.update_one(
                    {'id': job_id},
                    {'$set': {
                        'progress': progress,
                        'message': f'Sincronizados {idx}/{total} productos...'
                    }}
                )
        
        # Actualizar última sincronización
        await db.prestashop_integrations.update_one(
            {'id': integration_id},
            {'$set': {'last_sync_products': datetime.now(timezone.utc).isoformat()}}
        )
        
        # Marcar job como completado
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {
                'status': 'completed',
                'progress': 100,
                'message': f'{synced_count} productos sincronizados exitosamente',
                'completed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log
        log = {
            'id': str(uuid4()),
            'account_id': account_id,
            'integration_id': integration_id,
            'sync_type': 'products',
            'status': 'success',
            'message': f'{synced_count} productos sincronizados',
            'details': {'count': synced_count},
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.sync_logs.insert_one(log)
        
    except Exception as e:
        # Marcar job como fallido
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {
                'status': 'failed',
                'message': f'Error: {str(e)}',
                'completed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log error
        log = {
            'id': str(uuid4()),
            'account_id': account_id,
            'integration_id': integration_id,
            'sync_type': 'products',
            'status': 'error',
            'message': str(e),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.sync_logs.insert_one(log)


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


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener estado de un job de sincronización
    """
    job = await db.sync_jobs.find_one(
        get_tenant_filter(current_user.dict(), {'id': job_id}),
        {'_id': 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    
    return job


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
