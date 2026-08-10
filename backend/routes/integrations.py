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
from services.category_sync_service import CategorySyncService
from services.sync_service import SyncService
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from utils import db, get_current_user
from models.users import User

router = APIRouter(prefix="/integrations", tags=["integrations"])


class PrestashopConnectRequest(BaseModel):
    shop_url: str
    api_key: str
    store_id: str


class SyncResourcesRequest(BaseModel):
    """Request para sincronización selectiva de recursos"""
    resources: List[str]  # Lista de recursos a sincronizar: ['products', 'categories', 'orders', etc.]


class WebhookEvent(BaseModel):
    """Evento de webhook de PrestaShop"""
    event: str  # Tipo de evento: 'product_update', 'order_created', etc.
    resource: str  # Tipo de recurso: 'product', 'order', 'customer', etc.
    resource_id: int  # ID del recurso en PrestaShop
    data: Optional[Dict[str, Any]] = None  # Datos del evento
    timestamp: Optional[str] = None


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
        
        # SINCRONIZAR CATEGORÍAS A LA COLECCIÓN CATEGORIES (para UI)
        # Obtener integración para store_id
        integration_doc = await db.prestashop_integrations.find_one(
            {'id': integration_id},
            {'_id': 0}
        )
        
        if not integration_doc:
            raise HTTPException(status_code=404, detail="Integración no encontrada")
        
        store_id = integration_doc.get('store_id')
        store_name = integration_doc.get('store_name')
        
        # Obtener todas las categorías sincronizadas
        all_ps_categories = await db.prestashop_categories.find(
            {'account_id': current_user.account_id, 'integration_id': integration_id, 'active': True},
            {'_id': 0}
        ).to_list(1000)
        
        # Crear mapa de prestashop_id a categoría para resolver jerarquías
        ps_cat_map = {cat['prestashop_id']: cat for cat in all_ps_categories}
        
        # Sincronizar a colección categories
        for ps_cat in all_ps_categories:
            prestashop_id = ps_cat['prestashop_id']
            parent_ps_id = ps_cat.get('parent_id', 0)
            
            # Buscar si ya existe en categories (por account_id, store_id y prestashop_id)
            existing_cat = await db.categories.find_one(
                {
                    'account_id': current_user.account_id,
                    'store_id': store_id,
                    'prestashop_id': prestashop_id
                },
                {'_id': 0}
            )
            
            # Calcular level basado en jerarquía de PrestaShop
            level = 0
            parent_local_id = None
            
            if parent_ps_id and parent_ps_id > 0 and parent_ps_id in ps_cat_map:
                # Buscar parent en la colección categories
                parent_cat = await db.categories.find_one(
                    {
                        'account_id': current_user.account_id,
                        'store_id': store_id,
                        'prestashop_id': parent_ps_id
                    },
                    {'_id': 0}
                )
                
                if parent_cat:
                    parent_local_id = parent_cat['id']
                    level = parent_cat.get('level', 0) + 1
            
            # Limitar a máximo 4 niveles (0, 1, 2, 3)
            level = min(level, 3)
            
            category_doc = {
                'account_id': current_user.account_id,
                'store_id': store_id,
                'name': ps_cat['name'],
                'parent_id': parent_local_id,
                'level': level,
                'source': 'prestashop',
                'store': store_name,  # Nombre de tienda para compatibilidad legacy
                'prestashop_id': prestashop_id,
                'prestashop_parent_id': parent_ps_id,
                'integration_id': integration_id,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            if existing_cat:
                # Actualizar categoría existente
                await db.categories.update_one(
                    {
                        'account_id': current_user.account_id,
                        'store_id': store_id,
                        'prestashop_id': prestashop_id
                    },
                    {'$set': category_doc}
                )
            else:
                # Crear nueva categoría
                category_doc['id'] = str(uuid4())
                category_doc['created_at'] = datetime.now(timezone.utc).isoformat()
                await db.categories.insert_one(category_doc)
        
        # También actualizar settings legacy para compatibilidad (opcional)
        category_names = [cat.get('name') for cat in all_ps_categories if cat.get('name')]
        if category_names:
            settings = await db.settings.find_one(
                get_tenant_filter(current_user.dict(), {}),
                {'_id': 0}
            )
            
            if settings:
                existing_categories = settings.get('product_categories', [])
                combined_categories = list(set(existing_categories + category_names))
                
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
        
        # Obtener nombre de tienda
        account = await db.accounts.find_one({'id': account_id}, {'_id': 0})
        store_name = 'PrestaShop'
        store_code = 'A'
        if account and 'stores' in account:
            store_id = integration.get('store_id')
            matching_store = next((s for s in account['stores'] if s.get('id') == store_id), None)
            if matching_store:
                store_name = matching_store.get('name', 'PrestaShop')
                store_code = matching_store.get('code', 'A')
        
        # Crear servicio de sincronización de categorías
        # Instanciar servicio de sincronización de categorías
        category_sync = CategorySyncService(ps_service, account_id, store_name, integration_id, store_id)
        
        # Actualizar job
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {'status': 'running', 'message': 'Obteniendo productos de PrestaShop...'}}
        )
        
        # Obtener productos de PrestaShop en lotes pequeños (50 productos)
        # Solo pedir campos esenciales para evitar timeout
        all_products = []
        batch_size = 50
        offset = 0
        max_products = 5000  # Límite de seguridad
        
        # Campos específicos que necesitamos (reduce tamaño de respuesta)
        # Incluir manufacturer_name para obtener la marca del producto
        display_fields = '[id,name,reference,price,id_category_default,quantity,active,id_tax_rules_group,wholesale_price,available_for_order,visibility,manufacturer_name]'
        
        while offset < max_products:
            try:
                batch = ps_service.get_products(limit=batch_size, offset=offset, display=display_fields)
                
                if not batch:
                    break
                
                all_products.extend(batch)
                offset += len(batch)
                
                # Actualizar progreso
                progress = min(95, int((offset / max_products) * 100))
                await db.sync_jobs.update_one(
                    {'id': job_id},
                    {
                        '$set': {
                            'progress': progress,
                            'message': f'Obtenidos {len(all_products)} productos...'
                        }
                    }
                )
                
                # Si el lote es menor que batch_size, ya no hay más
                if len(batch) < batch_size:
                    break
                    
            except Exception as e:
                print(f"Error obteniendo lote en offset {offset}: {e}")
                # Si falla un lote, continuar con el siguiente
                offset += batch_size
                continue
        
        ps_products = all_products
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
            # Redondear a número entero como pidió el usuario
            cost_price = round(price_with_tax)
            sale_price = round(price_with_tax)  # Precio de venta con IVA redondeado
            
            # Obtener marca/fabricante
            brand_name = ps_prod.get('manufacturer_name', '')
            
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
            
            # Sincronizar categoría jerárquica de PrestaShop
            category_id = int(ps_prod.get('id_category_default', 0))
            category_local_id = None
            category_name = 'Sin categoría'
            
            if category_id > 0:
                # Sincronizar jerarquía completa de la categoría
                category_local_id = await category_sync.sync_category_hierarchy(category_id)
                
                if category_local_id:
                    # Obtener nombre de la categoría sincronizada
                    local_cat = await db.categories.find_one({'id': category_local_id}, {'_id': 0})
                    if local_cat:
                        category_name = local_cat.get('name', 'Sin categoría')
            
            # Preparar documento para colección local
            local_product_doc = {
                'account_id': account_id,
                'name': name,
                'sku': sku,
                'brand': brand_name,  # Marca desde PrestaShop
                'cost_price': cost_price,  # COSTO = Precio CON IVA de PrestaShop
                'sale_price': sale_price,  # Precio de venta CON IVA
                'stock': stock,
                'category': category_name,  # Nombre de categoría (temporal, para compatibilidad)
                'category_id': category_local_id,  # ID de categoría jerárquica
                'id_category_default': category_id,  # ⭐ NUEVO: Guardar ID original de PrestaShop
                'store': store_code,  # Código correcto de la tienda
                'min_stock': 5,  # Valor por defecto
                'prestashop_id': prod_id,  # Referencia al producto de PrestaShop
                'prestashop_integration_id': integration_id,  # Referencia a la integración
                'ecommerce_active': ps_prod.get('active', '1') == '1',  # Estado real de PrestaShop
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


@router.post("/prestashop/{integration_id}/sync")
async def sync_resources(
    integration_id: str,
    request: SyncResourcesRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar múltiples recursos seleccionados desde PrestaShop
    """
    # Validar que hay recursos seleccionados
    if not request.resources:
        raise HTTPException(status_code=400, detail="Debes seleccionar al menos un recurso")
    
    # Validar recursos permitidos
    allowed_resources = {
        'products', 'categories', 'prices', 'stock', 'images',
        'orders', 'customers', 'messages', 'abandoned_carts', 'completed_carts'
    }
    invalid = set(request.resources) - allowed_resources
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Recursos no válidos: {', '.join(invalid)}"
        )
    
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear job de sincronización multi-recurso
    job_id = str(uuid4())
    job = {
        'id': job_id,
        'account_id': current_user.account_id,
        'integration_id': integration_id,
        'type': 'sync_resources',
        'resources': request.resources,
        'status': 'running',
        'progress': 0,
        'results': {},  # Diccionario con resultados por recurso
        'message': 'Iniciando sincronización de recursos...',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sync_jobs.insert_one(job)
    
    # Ejecutar sincronización en background
    background_tasks.add_task(
        sync_resources_background,
        job_id,
        integration_id,
        integration,
        request.resources,
        current_user.account_id
    )
    
    return {
        'success': True,
        'job_id': job_id,
        'message': f'Sincronización de {len(request.resources)} recursos iniciada'
    }


async def sync_resources_background(
    job_id: str,
    integration_id: str,
    integration: dict,
    resources: List[str],
    account_id: str
):
    """
    Sincronizar múltiples recursos en background
    """
    try:
        # Crear servicio de PrestaShop
        ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
        
        # Obtener información de la tienda
        account = await db.accounts.find_one({'id': account_id}, {'_id': 0})
        store_name = 'PrestaShop'
        store_code = 'A'
        if account and 'stores' in account:
            store_id = integration.get('store_id')
            matching_store = next((s for s in account['stores'] if s.get('id') == store_id), None)
            if matching_store:
                store_name = matching_store.get('name', 'PrestaShop')
                store_code = matching_store.get('code', 'A')
        
        results = {}
        total_resources = len(resources)
        
        # Sincronizar cada recurso
        for idx, resource in enumerate(resources):
            progress = int((idx / total_resources) * 100)
            await db.sync_jobs.update_one(
                {'id': job_id},
                {'$set': {
                    'progress': progress,
                    'message': f'Sincronizando {resource}...'
                }}
            )
            
            try:
                if resource == 'categories':
                    count = await sync_categories_resource(ps_service, integration_id, account_id, store_name, store_id)
                    results['categories'] = count
                    
                elif resource == 'products':
                    count = await sync_products_resource(ps_service, integration_id, account_id, store_name, store_code, store_id)
                    results['products'] = count
                    
                elif resource == 'prices':
                    count = await sync_prices_resource(ps_service, integration_id, account_id)
                    results['prices'] = count
                    
                elif resource == 'stock':
                    count = await sync_stock_resource(ps_service, integration_id, account_id)
                    results['stock'] = count
                    
                elif resource == 'images':
                    count = await sync_images_resource(ps_service, integration_id, account_id)
                    results['images'] = count
                    
                elif resource == 'orders':
                    store_id = integration.get('store_id')
                    count = await sync_orders_resource(ps_service, integration_id, account_id, store_code, store_id)
                    results['orders'] = count
                    
                elif resource == 'customers':
                    count = await sync_customers_resource(ps_service, integration_id, account_id, store_code)
                    results['customers'] = count
                    
                elif resource == 'messages':
                    count = await sync_messages_resource(ps_service, integration_id, account_id)
                    results['messages'] = count
                    
                elif resource == 'abandoned_carts':
                    count = await sync_abandoned_carts_resource(ps_service, integration_id, account_id)
                    results['abandoned_carts'] = count
                    
                elif resource == 'completed_carts':
                    count = await sync_completed_carts_resource(ps_service, integration_id, account_id)
                    results['completed_carts'] = count
                    
            except Exception as e:
                # Si falla un recurso, continuar con los demás
                results[resource] = f"Error: {str(e)}"
        
        # Marcar job como completado
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {
                'status': 'completed',
                'progress': 100,
                'results': results,
                'message': 'Sincronización completada',
                'completed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
    except Exception as e:
        # Marcar job como fallido
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {
                'status': 'failed',
                'message': f'Error: {str(e)}',
                'failed_at': datetime.now(timezone.utc).isoformat()
            }}
        )


# Funciones helper para sincronizar cada tipo de recurso
async def sync_categories_resource(ps_service, integration_id: str, account_id: str, store_name: str, store_id: str = None) -> int:
    """Sincronizar categorías"""
    from services.category_sync_service import CategorySyncService
    
    category_sync = CategorySyncService(ps_service, account_id, store_name, integration_id, store_id)
    ps_categories = ps_service.get_categories(limit=200)
    
    synced_count = 0
    for ps_cat in ps_categories:
        cat_id = int(ps_cat.get('id', 0))
        if cat_id <= 0:
            continue
        
        # Buscar si ya existe
        existing = await db.prestashop_categories.find_one({
            'account_id': account_id,
            'integration_id': integration_id,
            'prestashop_id': cat_id
        }, {'_id': 0})
        
        name = ps_cat.get('name', {})
        if isinstance(name, dict):
            name = name.get('language', {}).get('value', f'Categoría {cat_id}')
        elif not name:
            name = f'Categoría {cat_id}'
        
        category_doc = {
            'account_id': account_id,
            'integration_id': integration_id,
            'prestashop_id': cat_id,
            'name': name,
            'parent_id': int(ps_cat.get('id_parent', 0)),
            'active': ps_cat.get('active', '1') == '1',
            'store_id': store_id,
            'store_name': store_name
        }
        
        if existing:
            await db.prestashop_categories.update_one(
                {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': cat_id},
                {'$set': category_doc}
            )
        else:
            category_doc['id'] = str(uuid4())
            category_doc['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.prestashop_categories.insert_one(category_doc)
        
        synced_count += 1
    
    # COPIAR A COLECCIÓN CATEGORIES (para UI)
    print(f"[SYNC] Copiando {synced_count} categorías a colección categories...")
    all_ps_categories = await db.prestashop_categories.find(
        {'account_id': account_id, 'integration_id': integration_id, 'active': True},
        {'_id': 0}
    ).to_list(1000)
    
    ps_cat_map = {cat['prestashop_id']: cat for cat in all_ps_categories}
    
    for ps_cat in all_ps_categories:
        prestashop_id = ps_cat['prestashop_id']
        parent_ps_id = ps_cat.get('parent_id', 0)
        
        existing_cat = await db.categories.find_one(
            {
                'account_id': account_id,
                'store_id': store_id,
                'prestashop_id': prestashop_id
            },
            {'_id': 0}
        )
        
        level = 0
        parent_local_id = None
        
        if parent_ps_id and parent_ps_id > 0 and parent_ps_id in ps_cat_map:
            parent_cat = await db.categories.find_one(
                {
                    'account_id': account_id,
                    'store_id': store_id,
                    'prestashop_id': parent_ps_id
                },
                {'_id': 0}
            )
            
            if parent_cat:
                parent_local_id = parent_cat['id']
                level = parent_cat.get('level', 0) + 1
        
        level = min(level, 3)
        
        category_doc_final = {
            'account_id': account_id,
            'store_id': store_id,
            'name': ps_cat['name'],
            'parent_id': parent_local_id,
            'level': level,
            'source': 'prestashop',
            'store': store_name,
            'prestashop_id': prestashop_id,
            'prestashop_parent_id': parent_ps_id,
            'integration_id': integration_id,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        if existing_cat:
            await db.categories.update_one(
                {
                    'account_id': account_id,
                    'store_id': store_id,
                    'prestashop_id': prestashop_id
                },
                {'$set': category_doc_final}
            )
        else:
            category_doc_final['id'] = str(uuid4())
            category_doc_final['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.categories.insert_one(category_doc_final)
    
    print(f"[SYNC] ✅ Copiadas {len(all_ps_categories)} categorías activas a colección categories")
    return synced_count


async def sync_products_resource(ps_service, integration_id: str, account_id: str, store_name: str, store_code: str, store_id: str = None) -> int:
    """Sincronizar productos con todos los campos: marca, categoría, precio, stock, publicación"""
    from services.category_sync_service import CategorySyncService
    
    print(f"[Sync] Iniciando sincronización de productos...")
    
    # Obtener manufacturers (marcas) una sola vez
    manufacturers_map = {}
    try:
        manufacturers = ps_service.get_manufacturers(limit=500)
        manufacturers_map = {m['id']: m['name'] for m in manufacturers}
        print(f"[Sync] {len(manufacturers_map)} marcas cargadas")
    except Exception as e:
        print(f"[Sync] Error cargando manufacturers: {e}")
    
    # Obtener categorías locales para mapeo
    categories_map = {}
    try:
        local_categories = await db.categories.find(
            {'account_id': account_id}, 
            {'_id': 0, 'prestashop_id': 1, 'name': 1}
        ).to_list(1000)
        categories_map = {int(c['prestashop_id']): c['name'] for c in local_categories if c.get('prestashop_id')}
        print(f"[Sync] {len(categories_map)} categorías locales mapeadas")
    except Exception as e:
        print(f"[Sync] Error cargando categorías: {e}")
    
    # Obtener productos de PrestaShop
    ps_products = ps_service.get_products(limit=500)
    print(f"[Sync] {len(ps_products)} productos obtenidos de PrestaShop")
    
    synced_count = 0
    for ps_prod in ps_products:
        prod_id = int(ps_prod.get('id', 0))
        if prod_id <= 0:
            continue
        
        # 1. Nombre (multiidioma)
        name = ps_prod.get('name', {})
        if isinstance(name, dict):
            if 'language' in name:
                lang = name['language']
                if isinstance(lang, list) and len(lang) > 0:
                    name = lang[0].get('value', f'Producto {prod_id}')
                elif isinstance(lang, dict):
                    name = lang.get('value', f'Producto {prod_id}')
                else:
                    name = f'Producto {prod_id}'
            else:
                name = name.get('value', f'Producto {prod_id}')
        elif not name:
            name = f'Producto {prod_id}'
        
        # 2. SKU/Reference
        sku = ps_prod.get('reference', f"PS-{prod_id}-{str(uuid4())[:8]}")
        
        # 3. Precio (convertir a ENTERO según handoff)
        price = float(ps_prod.get('price', 0))
        sale_price = round(price)  # Redondear a entero
        
        # 4. Marca (manufacturer)
        id_manufacturer = int(ps_prod.get('id_manufacturer', 0))
        brand = manufacturers_map.get(id_manufacturer, None)
        
        # 5. Categoría principal
        id_category_default = int(ps_prod.get('id_category_default', 0))
        category = categories_map.get(id_category_default, None)
        
        # 6. Stock disponible
        stock_quantity = ps_prod.get('quantity', 0)
        if isinstance(stock_quantity, dict):
            stock_quantity = int(stock_quantity.get('quantity', 0))
        else:
            stock_quantity = int(stock_quantity) if stock_quantity else 0
        
        # 7. Estado de publicación (active: 0|1)
        active = ps_prod.get('active', '0')
        ecommerce_active = active == '1' or active == 1 or active is True
        
        # 8. Fecha de vencimiento - OPCIONAL (no existe en PrestaShop estándar)
        # Se deja como None para que otras plataformas (WooCommerce, Shopify) puedan usarlo
        expiry_date = None
        
        # Buscar producto local existente por SKU
        local_product = await db.products.find_one({'sku': sku, 'account_id': account_id}, {'_id': 0})
        
        product_data = {
            'name': name,
            'sku': sku,
            'cost_price': 0,
            'sale_price': sale_price,
            'store': store_code,
            'store_id': store_id,
            'category': category,
            'brand': brand,
            'stock': stock_quantity,
            'ecommerce_active': ecommerce_active,
            'expiry_date': expiry_date,
            'prestashop_id': prod_id,
            'prestashop_integration_id': integration_id,
            'account_id': account_id
        }
        
        if local_product:
            # Actualizar producto existente
            await db.products.update_one(
                {'sku': sku, 'account_id': account_id}, 
                {'$set': product_data}
            )
        else:
            # Crear nuevo producto
            product_data['id'] = str(uuid4())
            product_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.products.insert_one(product_data)
        
        synced_count += 1
    
    print(f"[Sync] {synced_count} productos sincronizados correctamente")
    return synced_count


async def sync_prices_resource(ps_service, integration_id: str, account_id: str) -> int:
    """Sincronizar precios de productos existentes"""
    ps_products = ps_service.get_products(limit=500)
    updated_count = 0
    
    for ps_prod in ps_products:
        sku = ps_prod.get('reference', '')
        if not sku:
            continue
        
        price = float(ps_prod.get('price', 0))
        result = await db.products.update_one(
            {'account_id': account_id, 'sku': sku},
            {'$set': {'sale_price': price}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
    
    return updated_count


async def sync_stock_resource(ps_service, integration_id: str, account_id: str) -> int:
    """Sincronizar stock/inventario"""
    stock_dict = ps_service.get_all_stock(limit=1000)
    updated_count = 0
    
    # Actualizar stock en productos locales
    for product_id, quantity in stock_dict.items():
        # Buscar producto local por prestashop_id
        result = await db.products.update_one(
            {'account_id': account_id, 'prestashop_id': product_id},
            {'$set': {'stock_quantity': quantity}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
    
    return updated_count


async def sync_images_resource(ps_service, integration_id: str, account_id: str) -> int:
    """Sincronizar imágenes de productos"""
    import requests
    from io import BytesIO
    
    # Obtener productos sincronizados de PrestaShop
    ps_products = await db.prestashop_products.find(
        {'account_id': account_id, 'integration_id': integration_id},
        {'_id': 0, 'prestashop_id': 1, 'local_product_id': 1}
    ).limit(500).to_list(500)
    
    synced_count = 0
    for ps_prod in ps_products:
        ps_id = ps_prod.get('prestashop_id')
        local_id = ps_prod.get('local_product_id')
        
        if not ps_id or not local_id:
            continue
        
        # Obtener imágenes del producto desde PrestaShop
        images = ps_service.get_product_images(ps_id)
        
        if images:
            # Tomar la primera imagen (principal)
            main_image = images[0]
            image_url = main_image.get('url')
            
            if image_url:
                try:
                    # Descargar imagen
                    response = requests.get(image_url, auth=ps_service.auth, timeout=10)
                    if response.status_code == 200:
                        # Guardar URL de imagen en producto local
                        # En producción: subir a S3/CDN y guardar URL
                        await db.products.update_one(
                            {'id': local_id, 'account_id': account_id},
                            {'$set': {'image_url': image_url, 'has_image': True}}
                        )
                        synced_count += 1
                except Exception as e:
                    print(f"Error downloading image for product {ps_id}: {str(e)}")
    
    return synced_count


async def sync_orders_resource(ps_service, integration_id: str, account_id: str, store_code: str, store_id: str = None) -> int:
    """Sincronizar órdenes/pedidos"""
    ps_orders = ps_service.get_orders(limit=500)
    synced_count = 0
    
    for ps_order in ps_orders:
        order_id = int(ps_order.get('id', 0))
        if order_id <= 0:
            continue
        
        # Verificar si ya existe
        existing = await db.ecommerce_orders.find_one({
            'account_id': account_id,
            'integration_id': integration_id,
            'id': str(order_id)
        }, {'_id': 0})
        
        # Extraer datos de la orden
        order_data = {
            'account_id': account_id,
            'integration_id': integration_id,
            'store_id': store_id,  # ✅ AÑADIDO: store_id para filtrado por tienda
            'id': str(order_id),
            'reference': ps_order.get('reference', f'PS-{order_id}'),
            'customer_id': int(ps_order.get('id_customer', 0)),
            'customer_name': ps_order.get('customer', {}).get('firstname', '') + ' ' + ps_order.get('customer', {}).get('lastname', ''),
            'total_paid': float(ps_order.get('total_paid', 0)),
            'total_products': float(ps_order.get('total_products', 0)),
            'current_state': ps_order.get('current_state', 'pending'),
            'status': ps_order.get('current_state', 'pending'),
            'payment_method': ps_order.get('payment', 'Unknown'),
            'date_add': ps_order.get('date_add'),
            'date_upd': ps_order.get('date_upd'),
            'synced_at': datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            await db.ecommerce_orders.update_one(
                {'account_id': account_id, 'integration_id': integration_id, 'id': str(order_id)},
                {'$set': order_data}
            )
        else:
            order_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.ecommerce_orders.insert_one(order_data)
        
        synced_count += 1
    
    return synced_count


async def sync_customers_resource(ps_service, integration_id: str, account_id: str, store_code: str) -> int:
    """Sincronizar clientes"""
    ps_customers = ps_service.get_customers(limit=500)
    synced_count = 0
    
    for ps_customer in ps_customers:
        customer_id = int(ps_customer.get('id', 0))
        if customer_id <= 0:
            continue
        
        # Extraer nombre
        firstname = ps_customer.get('firstname', '')
        lastname = ps_customer.get('lastname', '')
        name = f"{firstname} {lastname}".strip()
        
        email = ps_customer.get('email', '')
        
        # Verificar si ya existe localmente por email
        existing_local = await db.customers.find_one({
            'account_id': account_id,
            'email': email
        }, {'_id': 0}) if email else None
        
        customer_data = {
            'name': name,
            'email': email,
            'phone': ps_customer.get('phone', '') or ps_customer.get('phone_mobile', ''),
            'store': store_code,
            'prestashop_id': customer_id,
            'customer_type': 'Persona'
        }
        
        if existing_local:
            # Actualizar cliente local
            await db.customers.update_one(
                {'id': existing_local['id'], 'account_id': account_id},
                {'$set': customer_data}
            )
        else:
            # Crear cliente local
            customer_data['id'] = str(uuid4())
            customer_data['account_id'] = account_id
            customer_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.customers.insert_one(customer_data)
        
        synced_count += 1
    
    return synced_count


async def sync_messages_resource(ps_service, integration_id: str, account_id: str) -> int:
    """Sincronizar mensajes e hilos de clientes"""
    ps_messages = ps_service.get_customer_messages(limit=200)
    synced_count = 0
    
    for ps_msg in ps_messages:
        msg_id = int(ps_msg.get('id', 0))
        if msg_id <= 0:
            continue
        
        # Verificar si ya existe
        existing = await db.customer_messages.find_one({
            'account_id': account_id,
            'integration_id': integration_id,
            'prestashop_id': msg_id
        }, {'_id': 0})
        
        message_data = {
            'account_id': account_id,
            'integration_id': integration_id,
            'prestashop_id': msg_id,
            'customer_id': int(ps_msg.get('id_customer', 0)),
            'order_id': int(ps_msg.get('id_order', 0)),
            'message': ps_msg.get('message', ''),
            'private': bool(int(ps_msg.get('private', 0))),
            'date_add': ps_msg.get('date_add')
        }
        
        if existing:
            await db.customer_messages.update_one(
                {'account_id': account_id, 'integration_id': integration_id, 'prestashop_id': msg_id},
                {'$set': message_data}
            )
        else:
            message_data['id'] = str(uuid4())
            message_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.customer_messages.insert_one(message_data)
        
        synced_count += 1
    
    return synced_count


async def sync_abandoned_carts_resource(ps_service, integration_id: str, account_id: str) -> int:
    """Sincronizar carritos abandonados"""
    # Obtener todos los carritos
    ps_carts = ps_service.get_carts(limit=500)
    
    # Obtener órdenes para identificar carritos convertidos
    ps_orders = ps_service.get_orders(limit=500)
    converted_cart_ids = {int(order.get('id_cart', 0)) for order in ps_orders if order.get('id_cart')}
    
    synced_count = 0
    for ps_cart in ps_carts:
        cart_id = int(ps_cart.get('id', 0))
        if cart_id <= 0:
            continue
        
        # Solo guardar carritos NO convertidos en órdenes
        if cart_id in converted_cart_ids:
            continue
        
        # Verificar si ya existe
        existing = await db.ecommerce_carts.find_one({
            'account_id': account_id,
            'integration_id': integration_id,
            'id': str(cart_id)
        }, {'_id': 0})
        
        cart_data = {
            'account_id': account_id,
            'integration_id': integration_id,
            'id': str(cart_id),
            'id_customer': int(ps_cart.get('id_customer', 0)),
            'date_add': ps_cart.get('date_add'),
            'date_upd': ps_cart.get('date_upd'),
            'id_order': None,  # Carrito abandonado sin orden
            'status': 'abandoned',
            'synced_at': datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            await db.ecommerce_carts.update_one(
                {'account_id': account_id, 'integration_id': integration_id, 'id': str(cart_id)},
                {'$set': cart_data}
            )
        else:
            cart_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.ecommerce_carts.insert_one(cart_data)
        
        synced_count += 1
    
    return synced_count


async def sync_completed_carts_resource(ps_service, integration_id: str, account_id: str) -> int:
    """Sincronizar carritos finalizados"""
    # Obtener carritos y órdenes
    ps_carts = ps_service.get_carts(limit=500)
    ps_orders = ps_service.get_orders(limit=500)
    
    # Crear mapeo cart_id -> order
    cart_to_order = {int(order.get('id_cart', 0)): order for order in ps_orders if order.get('id_cart')}
    
    synced_count = 0
    for ps_cart in ps_carts:
        cart_id = int(ps_cart.get('id', 0))
        if cart_id <= 0:
            continue
        
        # Solo guardar carritos convertidos en órdenes
        if cart_id not in cart_to_order:
            continue
        
        related_order = cart_to_order[cart_id]
        order_id = int(related_order.get('id', 0))
        
        # Verificar si ya existe
        existing = await db.ecommerce_carts.find_one({
            'account_id': account_id,
            'integration_id': integration_id,
            'id': str(cart_id)
        }, {'_id': 0})
        
        cart_data = {
            'account_id': account_id,
            'integration_id': integration_id,
            'id': str(cart_id),
            'id_customer': int(ps_cart.get('id_customer', 0)),
            'id_order': str(order_id),  # Orden asociada
            'order_reference': related_order.get('reference', ''),
            'total_paid': float(related_order.get('total_paid', 0)),
            'date_add': ps_cart.get('date_add'),
            'date_completed': related_order.get('date_add'),
            'status': 'completed',
            'synced_at': datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            await db.ecommerce_carts.update_one(
                {'account_id': account_id, 'integration_id': integration_id, 'id': str(cart_id)},
                {'$set': cart_data}
            )
        else:
            cart_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.ecommerce_carts.insert_one(cart_data)
        
        synced_count += 1
    
    return synced_count


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


@router.post("/webhooks/prestashop/{integration_id}")
async def receive_webhook(
    integration_id: str,
    event: WebhookEvent,
    background_tasks: BackgroundTasks
):
    """
    Recibir webhook de PrestaShop para actualizaciones en tiempo real
    
    Este endpoint NO requiere autenticación porque es llamado por PrestaShop
    Se debe validar el integration_id y opcionalmente un token secreto
    """
    # Verificar que la integración existe
    integration = await db.prestashop_integrations.find_one(
        {'id': integration_id},
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Guardar evento de webhook en log
    webhook_log = {
        'id': str(uuid4()),
        'integration_id': integration_id,
        'account_id': integration['account_id'],
        'event_type': event.event,
        'resource_type': event.resource,
        'resource_id': event.resource_id,
        'data': event.data,
        'timestamp': event.timestamp or datetime.now(timezone.utc).isoformat(),
        'processed': False,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.webhook_events.insert_one(webhook_log)
    
    # Procesar webhook en background
    background_tasks.add_task(
        process_webhook_background,
        integration_id,
        integration,
        event
    )
    
    return {'success': True, 'message': 'Webhook recibido y en proceso'}


async def process_webhook_background(integration_id: str, integration: dict, event: WebhookEvent):
    """
    Procesar webhook en background
    """
    try:
        ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
        account_id = integration['account_id']
        
        # Obtener información de la tienda
        account = await db.accounts.find_one({'id': account_id}, {'_id': 0})
        store_code = 'A'
        store_name = 'PrestaShop'
        if account and 'stores' in account:
            store_id = integration.get('store_id')
            matching_store = next((s for s in account['stores'] if s.get('id') == store_id), None)
            if matching_store:
                store_code = matching_store.get('code', 'A')
                store_name = matching_store.get('name', 'PrestaShop')
        
        # Procesar según tipo de evento
        if event.resource == 'product':
            if event.event in ['product_created', 'product_updated']:
                # Sincronizar este producto específico
                await sync_single_product(ps_service, integration_id, account_id, event.resource_id, store_code)
            elif event.event == 'product_deleted':
                # Eliminar producto local
                await db.products.delete_one({
                    'account_id': account_id,
                    'prestashop_id': event.resource_id
                })
        
        elif event.resource == 'order':
            if event.event in ['order_created', 'order_updated']:
                # Sincronizar esta orden específica
                await sync_single_order(ps_service, integration_id, account_id, event.resource_id, store_code)
        
        elif event.resource == 'customer':
            if event.event in ['customer_created', 'customer_updated']:
                # Sincronizar este cliente específico
                await sync_single_customer(ps_service, integration_id, account_id, event.resource_id, store_code)
        
        elif event.resource == 'stock':
            if event.event == 'stock_updated':
                # Actualizar stock del producto
                await sync_single_stock(ps_service, account_id, event.resource_id)
        
        # Marcar webhook como procesado
        await db.webhook_events.update_one(
            {'integration_id': integration_id, 'resource_id': event.resource_id, 'processed': False},
            {'$set': {
                'processed': True,
                'processed_at': datetime.now(timezone.utc).isoformat(),
                'retry_count': 0
            }}
        )
        
    except Exception as e:
        print(f"Error processing webhook: {str(e)}")
        
        # Obtener el evento para verificar reintentos
        webhook_event = await db.webhook_events.find_one({
            'integration_id': integration_id,
            'resource_id': event.resource_id,
            'processed': False
        })
        
        retry_count = webhook_event.get('retry_count', 0) if webhook_event else 0
        
        # Marcar como error y programar reintento si es posible
        if retry_count < 3:  # Máximo 3 reintentos
            await db.webhook_events.update_one(
                {'integration_id': integration_id, 'resource_id': event.resource_id},
                {'$set': {
                    'error': str(e),
                    'error_at': datetime.now(timezone.utc).isoformat(),
                    'retry_count': retry_count + 1,
                    'retry_scheduled': True
                }}
            )
            print(f"Reintento programado ({retry_count + 1}/3) para webhook {event.resource_id}")
        else:
            # Excedió reintentos, marcar como error permanente
            await db.webhook_events.update_one(
                {'integration_id': integration_id, 'resource_id': event.resource_id},
                {'$set': {
                    'error': str(e),
                    'error_at': datetime.now(timezone.utc).isoformat(),
                    'retry_count': retry_count,
                    'retry_failed': True
                }}
            )
            print(f"Webhook {event.resource_id} falló después de {retry_count} reintentos")


# Funciones helper para sincronizar recursos individuales
async def sync_single_product(ps_service, integration_id: str, account_id: str, product_id: int, store_code: str):
    """Sincronizar un solo producto"""
    try:
        ps_product = ps_service.get_product(product_id)
        if not ps_product:
            return
        
        name = ps_product.get('name', {})
        if isinstance(name, dict):
            name = name.get('language', {}).get('value', f'Producto {product_id}')
        
        sku = ps_product.get('reference', f"PS-{product_id}")
        
        product_data = {
            'name': name,
            'sku': sku,
            'sale_price': float(ps_product.get('price', 0)),
            'store': store_code,
            'prestashop_id': product_id
        }
        
        # Buscar si existe localmente
        local_product = await db.products.find_one({'sku': sku}, {'_id': 0})
        
        if local_product:
            await db.products.update_one({'sku': sku}, {'$set': product_data})
        else:
            product_data['id'] = str(uuid4())
            product_data['account_id'] = account_id
            product_data['cost_price'] = 0
            product_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.products.insert_one(product_data)
            
    except Exception as e:
        print(f"Error syncing single product {product_id}: {str(e)}")


async def sync_single_order(ps_service, integration_id: str, account_id: str, order_id: int, store_code: str):
    """Sincronizar una sola orden"""
    try:
        ps_order = ps_service.get_order_details(order_id)
        if not ps_order:
            return
        
        order_data = {
            'account_id': account_id,
            'integration_id': integration_id,
            'prestashop_id': order_id,
            'reference': ps_order.get('reference', f'PS-{order_id}'),
            'customer_id': int(ps_order.get('id_customer', 0)),
            'total_paid': float(ps_order.get('total_paid', 0)),
            'current_state': int(ps_order.get('current_state', 0)),
            'payment_method': ps_order.get('payment', 'Unknown'),
            'date_add': ps_order.get('date_add')
        }
        
        existing = await db.prestashop_orders.find_one({
            'account_id': account_id,
            'prestashop_id': order_id
        }, {'_id': 0})
        
        if existing:
            await db.prestashop_orders.update_one(
                {'account_id': account_id, 'prestashop_id': order_id},
                {'$set': order_data}
            )
        else:
            order_data['id'] = str(uuid4())
            order_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.prestashop_orders.insert_one(order_data)
            
    except Exception as e:
        print(f"Error syncing single order {order_id}: {str(e)}")


async def sync_single_customer(ps_service, integration_id: str, account_id: str, customer_id: int, store_code: str):
    """Sincronizar un solo cliente"""
    try:
        ps_customers = ps_service.get_customers(limit=1)
        # PrestaShop API no tiene get_customer individual, usar filter
        # Por ahora sincronizar todos y filtrar
        
    except Exception as e:
        print(f"Error syncing single customer {customer_id}: {str(e)}")


async def sync_single_stock(ps_service, account_id: str, product_id: int):
    """Sincronizar stock de un solo producto"""
    try:
        stock_dict = ps_service.get_all_stock(limit=1000)
        if product_id in stock_dict:
            quantity = stock_dict[product_id]
            await db.products.update_one(
                {'account_id': account_id, 'prestashop_id': product_id},
                {'$set': {'stock_quantity': quantity}}
            )
    except Exception as e:
        print(f"Error syncing stock for product {product_id}: {str(e)}")


@router.post("/prestashop/{integration_id}/sync-incremental")
async def sync_incremental(
    integration_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Sincronización incremental: solo cambios desde última sincronización
    """
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear job de sincronización incremental
    job_id = str(uuid4())
    job = {
        'id': job_id,
        'account_id': current_user.account_id,
        'integration_id': integration_id,
        'type': 'sync_incremental',
        'status': 'running',
        'progress': 0,
        'results': {},
        'message': 'Iniciando sincronización incremental...',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sync_jobs.insert_one(job)
    
    # Ejecutar sincronización incremental en background
    background_tasks.add_task(
        sync_incremental_background,
        job_id,
        integration_id,
        integration,
        current_user.account_id
    )
    
    return {
        'success': True,
        'job_id': job_id,
        'message': 'Sincronización incremental iniciada'
    }


async def sync_incremental_background(job_id: str, integration_id: str, integration: dict, account_id: str):
    """
    Sincronizar solo cambios desde la última sincronización
    """
    try:
        ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
        
        # Obtener fecha de última sincronización
        last_sync_products = integration.get('last_sync_products')
        last_sync_orders = integration.get('last_sync_orders')
        last_sync_customers = integration.get('last_sync_customers')
        
        results = {}
        
        # Sincronizar productos modificados
        if last_sync_products:
            date_from = last_sync_products.split('T')[0]  # Formato YYYY-MM-DD
            # PrestaShop API no soporta filtro por fecha de modificación fácilmente
            # Obtener todos y filtrar localmente
            ps_products = ps_service.get_products(limit=500)
            # Filtrar por fecha
            # ... implementar lógica de filtrado
            results['products'] = len(ps_products)
        
        # Sincronizar órdenes nuevas
        if last_sync_orders:
            date_from = last_sync_orders.split('T')[0]
            ps_orders = ps_service.get_orders(limit=500, date_from=date_from)
            # Procesar órdenes...
            results['orders'] = len(ps_orders)
        
        # Sincronizar clientes nuevos
        if last_sync_customers:
            date_from = last_sync_customers.split('T')[0]
            ps_customers = ps_service.get_customers(limit=500, date_from=date_from)
            results['customers'] = len(ps_customers)
        
        # Actualizar fechas de última sincronización
        now = datetime.now(timezone.utc).isoformat()
        await db.prestashop_integrations.update_one(
            {'id': integration_id},
            {'$set': {
                'last_sync_products': now,
                'last_sync_orders': now,
                'last_sync_customers': now,
                'last_sync_stock': now
            }}
        )
        
        # Marcar job como completado
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {
                'status': 'completed',
                'progress': 100,
                'results': results,
                'message': 'Sincronización incremental completada',
                'completed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
    except Exception as e:
        await db.sync_jobs.update_one(
            {'id': job_id},
            {'$set': {
                'status': 'failed',
                'message': f'Error: {str(e)}',
                'failed_at': datetime.now(timezone.utc).isoformat()
            }}
        )


@router.post("/webhooks/prestashop/{integration_id}/test")
async def test_webhook(
    integration_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Enviar un webhook de prueba para verificar la conexión
    """
    # Verificar que la integración existe
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear evento de prueba
    test_event = {
        'id': str(uuid4()),
        'integration_id': integration_id,
        'account_id': current_user.account_id,
        'event_type': 'test',
        'resource_type': 'test',
        'resource_id': 0,
        'data': {'message': 'Webhook de prueba desde Negocio Feliz'},
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'processed': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'test': True
    }
    
    await db.webhook_events.insert_one(test_event)
    
    return {
        'success': True,
        'message': 'Webhook de prueba creado exitosamente',
        'event_id': test_event['id'],
        'instructions': 'Si el módulo está configurado correctamente en PrestaShop, los webhooks reales se registrarán aquí cuando hagas cambios en tu tienda (crear/editar productos, recibir órdenes, etc.)'
    }


@router.get("/webhooks/prestashop/{integration_id}/status")
async def get_webhook_status(integration_id: str):
    """
    Verificar estado del webhook de una integración
    No requiere autenticación - es un endpoint de verificación
    """
    try:
        # Buscar últimos eventos de webhook (excluyendo tests)
        recent_events = await db.webhook_events.find(
            {
                'integration_id': integration_id,
                'test': {'$ne': True}  # Excluir eventos de prueba
            },
            {'_id': 0}
        ).sort('timestamp', -1).limit(10).to_list(10)
        
        # Contar total de eventos (incluyendo tests)
        total_events = await db.webhook_events.count_documents({
            'integration_id': integration_id
        })
        
        if not recent_events:
            # Verificar si hay al menos un evento de prueba
            test_events = await db.webhook_events.count_documents({
                'integration_id': integration_id,
                'test': True
            })
            
            if test_events > 0:
                return {
                    'status': 'configured',
                    'message': 'Webhook configurado (solo pruebas)',
                    'last_event': None,
                    'event_count': 0,
                    'test_events': test_events,
                    'instructions': 'Esperando eventos reales desde PrestaShop. Para recibirlos necesitas un dominio público en producción.'
                }
            else:
                return {
                    'status': 'not_configured',
                    'message': 'Sin webhooks recibidos',
                    'last_event': None,
                    'event_count': 0,
                    'instructions': 'Haz clic en "Probar Webhook" para verificar la configuración'
                }
        
        # Verificar si hay eventos recientes (últimas 24 horas)
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        last_event = recent_events[0]
        
        # Manejar diferentes formatos de timestamp
        timestamp_str = last_event.get('timestamp') or last_event.get('created_at')
        if timestamp_str:
            last_event_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            last_event_time = now - timedelta(days=999)  # Muy antiguo
        
        time_diff = now - last_event_time
        
        # Verificar si hay errores en los últimos eventos
        error_count = sum(1 for e in recent_events if e.get('error'))
        
        # Determinar estado
        if error_count > 5:
            status = 'error'
            message = f'{error_count} webhooks con errores recientes'
        elif time_diff < timedelta(hours=1):
            status = 'active'
            minutes = int(time_diff.total_seconds() / 60)
            message = f'Último webhook hace {minutes} minuto{"s" if minutes != 1 else ""}'
        elif time_diff < timedelta(hours=24):
            status = 'active'
            hours = int(time_diff.total_seconds() / 3600)
            message = f'Último webhook hace {hours} hora{"s" if hours != 1 else ""}'
        elif time_diff < timedelta(days=7):
            status = 'inactive'
            days = int(time_diff.days)
            message = f'Sin actividad hace {days} día{"s" if days != 1 else ""}'
        else:
            status = 'inactive'
            message = f'Sin actividad hace {time_diff.days} días'
        
        return {
            'status': status,
            'message': message,
            'last_event': last_event_time.isoformat(),
            'event_count': len(recent_events),
            'total_events': total_events,
            'error_count': error_count
        }
        
    except Exception as e:
        print(f"Error checking webhook status: {str(e)}")
        return {
            'status': 'unknown',
            'message': 'No se pudo verificar el estado',
            'error': str(e)
        }



@router.get("/webhooks/prestashop/{integration_id}/logs")
async def get_webhook_logs(
    integration_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener logs de webhooks de una integración
    """
    # Verificar que la integración pertenece al usuario
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Obtener todos los eventos (incluyendo tests), ordenados por más reciente
    logs = await db.webhook_events.find(
        {'integration_id': integration_id},
        {'_id': 0}
    ).sort('timestamp', -1).limit(100).to_list(100)
    
    return logs


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


@router.delete("/prestashop/{integration_id}/clear-data")
async def clear_integration_data(
    integration_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Borrar todo el contenido sincronizado de una integración sin eliminar la configuración.
    Solo disponible para account_admin.
    """
    # Verificar que el usuario es account_admin
    if current_user.role != 'account_admin':
        raise HTTPException(
            status_code=403, 
            detail="Solo los administradores de cuenta pueden borrar contenido sincronizado"
        )
    
    # Verificar que la integración existe
    integration = await db.prestashop_integrations.find_one(
        get_tenant_filter(current_user.dict(), {'id': integration_id}),
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Contar registros antes de borrar
    counts = {
        'orders': await db.ecommerce_orders.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'customers': await db.ecommerce_customers.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'carts': await db.ecommerce_carts.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'prestashop_products': await db.prestashop_products.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'prestashop_categories': await db.prestashop_categories.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'prestashop_orders': await db.prestashop_orders.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'stock_conflicts': await db.stock_conflicts.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id}),
        'inventory_products': await db.products.count_documents({'prestashop_integration_id': integration_id, 'account_id': current_user.account_id}),
        'local_categories': await db.categories.count_documents({'integration_id': integration_id, 'account_id': current_user.account_id})
    }
    
    # Borrar todos los datos sincronizados
    await db.ecommerce_orders.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    await db.ecommerce_customers.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    await db.ecommerce_carts.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    await db.prestashop_products.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    await db.prestashop_categories.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    await db.prestashop_orders.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    await db.stock_conflicts.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    
    # ✅ Borrar productos del inventario local que fueron sincronizados
    await db.products.delete_many({'prestashop_integration_id': integration_id, 'account_id': current_user.account_id})
    
    # ✅ Borrar categorías locales que fueron sincronizadas
    await db.categories.delete_many({'integration_id': integration_id, 'account_id': current_user.account_id})
    
    # Registrar acción en logs
    log = {
        'id': str(uuid4()),
        'account_id': current_user.account_id,
        'integration_id': integration_id,
        'sync_type': 'clear_data',
        'status': 'success',
        'message': f'Contenido sincronizado borrado por {current_user.email}',
        'details': counts,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.sync_logs.insert_one(log)
    
    total_deleted = sum(counts.values())
    
    return {
        'success': True, 
        'message': f'{total_deleted} registros eliminados exitosamente',
        'details': counts
    }



@router.patch("/prestashop/{integration_id}")
async def update_prestashop_integration(
    integration_id: str,
    shop_name: str = None,
    store_code: str = None,
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar información de integración PrestaShop
    Actualiza en cascada el nombre en todas las órdenes, carritos y clientes relacionados
    """
    from bson import ObjectId
    
    try:
        # Validar que la integración existe y pertenece al usuario
        integration = await db.prestashop_integrations.find_one({
            "_id": ObjectId(integration_id),
            "account_id": current_user.account_id
        })
        
        if not integration:
            raise HTTPException(status_code=404, detail="Integración no encontrada")
        
        # Preparar actualización
        update_data = {}
        if shop_name:
            update_data["shop_name"] = shop_name
        if store_code:
            update_data["store_code"] = store_code
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")
        
        # 1. Actualizar integración
        await db.prestashop_integrations.update_one(
            {"_id": ObjectId(integration_id)},
            {"$set": update_data}
        )
        
        # 2. Actualizar en cascada en todas las colecciones relacionadas
        cascade_update = {}
        if shop_name:
            cascade_update["store_name"] = shop_name
        if store_code:
            cascade_update["store_code"] = store_code
        
        if cascade_update:
            # Actualizar órdenes
            orders_result = await db.ecommerce_orders.update_many(
                {"integration_id": integration_id, "account_id": current_user.account_id},
                {"$set": cascade_update}
            )
            
            # Actualizar carritos
            carts_result = await db.ecommerce_carts.update_many(
                {"integration_id": integration_id, "account_id": current_user.account_id},
                {"$set": cascade_update}
            )
            
            # Actualizar clientes
            customers_result = await db.ecommerce_customers.update_many(
                {"integration_id": integration_id, "account_id": current_user.account_id},
                {"$set": cascade_update}
            )
            
            return {
                "success": True,
                "message": "Integración actualizada exitosamente",
                "updated": {
                    "integration": True,
                    "orders": orders_result.modified_count,
                    "carts": carts_result.modified_count,
                    "customers": customers_result.modified_count
                }
            }
        
        return {"success": True, "message": "Integración actualizada exitosamente"}
        
    except Exception as e:
        print(f"Error updating integration: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar integración: {str(e)}"
        )



@router.get("/prestashop/download-module")
async def download_prestashop_module():
    """
    Descargar módulo de webhooks para PrestaShop
    No requiere autenticación - es un recurso público
    """
    import zipfile
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    # Ruta del módulo
    module_path = '/app/backend/static/prestashop_module/emergent_webhooks'
    
    # Crear ZIP en memoria
    zip_buffer = BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Agregar archivos del módulo
        import os
        for root, dirs, files in os.walk(module_path):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, os.path.dirname(module_path))
                zip_file.write(file_path, arcname)
    
    # Preparar respuesta
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type='application/zip',
        headers={
            'Content-Disposition': 'attachment; filename="emergent_webhooks.zip"'
        }
    )



@router.post("/ecommerce/sync-new-orders")
async def sync_new_ecommerce_orders(
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar órdenes nuevas desde todas las integraciones PrestaShop
    Se ejecuta automáticamente cada pocos minutos o manualmente
    """
    try:
        # Obtener todas las integraciones activas del usuario
        integrations = await db.prestashop_integrations.find(
            {'account_id': current_user.account_id, 'is_active': True},
            {'_id': 0}
        ).to_list(10)
        
        if not integrations:
            return {
                'success': False,
                'message': 'No hay integraciones activas',
                'total_new_orders': 0
            }
        
        total_new_orders = 0
        results = []
        
        for integration in integrations:
            result = await SyncService.sync_new_orders(
                account_id=current_user.account_id,
                store_id=integration.get('store_id'),
                integration_id=integration['id']
            )
            
            if result['success']:
                total_new_orders += result.get('new_orders', 0)
            
            results.append({
                'store_id': integration.get('store_id'),
                'shop_url': integration.get('shop_url'),
                'result': result
            })
        
        return {
            'success': True,
            'total_new_orders': total_new_orders,
            'integrations': results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sincronizando órdenes: {str(e)}"
        )


@router.post("/ecommerce/sync-order-states")
async def sync_ecommerce_order_states(
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar estados de órdenes desde PrestaShop
    Actualiza órdenes que han cambiado de estado
    """
    try:
        result = await SyncService.sync_order_states(current_user.account_id)
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result['message'])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sincronizando estados: {str(e)}"
        )


@router.post("/products/{product_id}/sync-stock")
async def sync_product_stock_to_prestashop(
    product_id: str,
    new_stock: int,
    current_user: User = Depends(get_current_user)
):
    """
    Sincronizar stock de un producto hacia PrestaShop
    Se ejecuta automáticamente cuando se actualiza stock en inventario
    """
    try:
        result = await SyncService.sync_stock_to_prestashop(
            account_id=current_user.account_id,
            product_id=product_id,
            new_stock=new_stock
        )
        
        if not result['success']:
            raise HTTPException(status_code=500, detail=result['message'])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sincronizando stock: {str(e)}"
        )

