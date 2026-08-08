"""
Servicio de sincronización automática en tiempo real
Sincroniza órdenes, stocks y estados entre Negocio Feliz y PrestaShop
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from services.prestashop_service import PrestashopAPIService
from utils import db


class SyncService:
    """Servicio para sincronización bidireccional automática"""
    
    @staticmethod
    async def sync_new_orders(account_id: str, store_id: str, integration_id: str) -> Dict[str, Any]:
        """
        Sincronizar órdenes nuevas desde PrestaShop
        Solo sincroniza órdenes creadas en los últimos 5 minutos
        """
        try:
            # Obtener integración
            integration = await db.prestashop_integrations.find_one(
                {'id': integration_id, 'account_id': account_id},
                {'_id': 0}
            )
            
            if not integration:
                return {'success': False, 'message': 'Integración no encontrada'}
            
            ps_service = PrestashopAPIService(
                shop_url=integration['shop_url'],
                api_key=integration['api_key']
            )
            
            # Obtener última orden sincronizada
            last_order = await db.ecommerce_orders.find_one(
                {'account_id': account_id, 'store_id': store_id},
                {'_id': 0, 'id': 1},
                sort=[('date_add', -1)]
            )
            
            last_order_id = int(last_order['id']) if last_order else 0
            
            # Obtener órdenes desde PrestaShop (últimas 20)
            response = ps_service._make_request('orders', params={
                'display': 'full',
                'sort': '[id_DESC]',
                'limit': '0,20'
            })
            
            if 'orders' not in response or not isinstance(response['orders'], list):
                return {'success': False, 'message': 'No se pudieron obtener órdenes'}
            
            orders = response['orders']
            new_orders_count = 0
            
            for order in orders:
                order_id = int(order.get('id', 0))
                
                # Solo sincronizar órdenes nuevas
                if order_id <= last_order_id:
                    continue
                
                # Verificar si ya existe
                existing = await db.ecommerce_orders.find_one({
                    'account_id': account_id,
                    'id': str(order_id)
                })
                
                if existing:
                    continue
                
                # Crear documento de orden
                # Obtener _id de la integración de MongoDB
                integration_mongo = await db.prestashop_integrations.find_one(
                    {'id': integration_id},
                    {'_id': 1}
                )
                integration_mongo_id = str(integration_mongo['_id']) if integration_mongo else integration_id
                
                order_doc = {
                    'account_id': account_id,
                    'integration_id': integration_mongo_id,
                    'store_id': store_id,
                    'store_code': integration.get('store_code'),
                    'id': str(order_id),
                    'reference': order.get('reference', ''),
                    'customer_id': order.get('id_customer'),
                    'customer_name': f"{order.get('firstname', '')} {order.get('lastname', '')}".strip(),
                    'total_paid': float(order.get('total_paid', 0)),
                    'total_products': float(order.get('total_products', 0)),
                    'current_state': str(order.get('current_state', '')),
                    'status': str(order.get('current_state', '')),
                    'payment_method': order.get('payment', ''),
                    'date_add': order.get('date_add', ''),
                    'date_upd': order.get('date_upd', ''),
                    'synced_at': datetime.now(timezone.utc).isoformat(),
                    'created_at': datetime.now(timezone.utc).isoformat()
                }
                
                await db.ecommerce_orders.insert_one(order_doc)
                new_orders_count += 1
            
            return {
                'success': True,
                'new_orders': new_orders_count,
                'message': f'Sincronizadas {new_orders_count} órdenes nuevas'
            }
            
        except Exception as e:
            print(f"Error syncing new orders: {e}")
            return {'success': False, 'message': str(e)}
    
    
    @staticmethod
    async def sync_order_states(account_id: str) -> Dict[str, Any]:
        """
        Sincronizar estados de órdenes desde PrestaShop
        Actualiza el estado de órdenes que han cambiado
        """
        try:
            # Obtener todas las integraciones activas
            integrations = await db.prestashop_integrations.find(
                {'account_id': account_id, 'is_active': True},
                {'_id': 0}
            ).to_list(10)
            
            if not integrations:
                return {'success': False, 'message': 'No hay integraciones activas'}
            
            total_updated = 0
            
            for integration in integrations:
                ps_service = PrestashopAPIService(
                    shop_url=integration['shop_url'],
                    api_key=integration['api_key']
                )
                
                store_id = integration.get('store_id')
                
                # Obtener órdenes locales de esta tienda (últimas 50)
                local_orders = await db.ecommerce_orders.find(
                    {
                        'account_id': account_id,
                        'store_id': store_id
                    },
                    {'_id': 0, 'id': 1, 'current_state': 1}
                ).sort('date_add', -1).limit(50).to_list(50)
                
                for local_order in local_orders:
                    order_id = local_order['id']
                    local_state = local_order.get('current_state')
                    
                    try:
                        # Obtener orden de PrestaShop
                        response = ps_service._make_request(f'orders/{order_id}', params={'display': 'full'})
                        
                        if 'order' in response:
                            ps_order = response['order']
                            ps_state = str(ps_order.get('current_state', ''))
                            
                            # Si el estado cambió, actualizar
                            if ps_state != local_state:
                                await db.ecommerce_orders.update_one(
                                    {'account_id': account_id, 'id': order_id},
                                    {
                                        '$set': {
                                            'current_state': ps_state,
                                            'status': ps_state,
                                            'date_upd': ps_order.get('date_upd', ''),
                                            'synced_at': datetime.now(timezone.utc).isoformat()
                                        }
                                    }
                                )
                                total_updated += 1
                    except Exception as e:
                        print(f"Error syncing order {order_id}: {e}")
                        continue
            
            return {
                'success': True,
                'updated_orders': total_updated,
                'message': f'Actualizados {total_updated} estados de órdenes'
            }
            
        except Exception as e:
            print(f"Error syncing order states: {e}")
            return {'success': False, 'message': str(e)}
    
    
    @staticmethod
    async def sync_stock_to_prestashop(account_id: str, product_id: str, new_stock: int) -> Dict[str, Any]:
        """
        Sincronizar stock desde Negocio Feliz hacia PrestaShop
        Se ejecuta cuando se actualiza stock en el inventario local
        """
        try:
            # Obtener producto local
            product = await db.products.find_one(
                {'account_id': account_id, 'id': product_id},
                {'_id': 0}
            )
            
            if not product:
                return {'success': False, 'message': 'Producto no encontrado'}
            
            sku = product.get('sku')
            if not sku:
                return {'success': False, 'message': 'Producto sin SKU'}
            
            # Obtener integraciones activas
            integrations = await db.prestashop_integrations.find(
                {'account_id': account_id, 'is_active': True},
                {'_id': 0}
            ).to_list(10)
            
            updated_count = 0
            
            for integration in integrations:
                ps_service = PrestashopAPIService(
                    shop_url=integration['shop_url'],
                    api_key=integration['api_key']
                )
                
                try:
                    # Buscar producto en PrestaShop por SKU
                    response = ps_service._make_request('products', params={
                        'filter[reference]': sku,
                        'display': '[id]'
                    })
                    
                    if 'products' in response and response['products']:
                        ps_products = response['products']
                        if isinstance(ps_products, list) and len(ps_products) > 0:
                            ps_product_id = ps_products[0].get('id')
                            
                            # Actualizar stock en PrestaShop
                            success = await SyncService._update_prestashop_stock(
                                ps_service,
                                ps_product_id,
                                new_stock
                            )
                            
                            if success:
                                updated_count += 1
                
                except Exception as e:
                    print(f"Error updating stock in PrestaShop integration: {e}")
                    continue
            
            # Actualizar timestamp de última sincronización
            await db.products.update_one(
                {'account_id': account_id, 'id': product_id},
                {'$set': {'last_stock_sync': datetime.now(timezone.utc).isoformat()}}
            )
            
            return {
                'success': True,
                'updated_integrations': updated_count,
                'message': f'Stock actualizado en {updated_count} integración(es)'
            }
            
        except Exception as e:
            print(f"Error syncing stock to PrestaShop: {e}")
            return {'success': False, 'message': str(e)}
    
    
    @staticmethod
    async def _update_prestashop_stock(ps_service: PrestashopAPIService, product_id: int, quantity: int) -> bool:
        """
        Actualizar stock de un producto en PrestaShop
        """
        try:
            # PrestaShop maneja stock a través de stock_availables
            # Primero obtener el id de stock_available del producto
            response = ps_service._make_request(f'products/{product_id}', params={'display': 'full'})
            
            if 'product' not in response:
                return False
            
            product = response['product']
            
            # Obtener associations de stock
            stock_available_id = None
            if 'associations' in product and 'stock_availables' in product['associations']:
                stock_availables = product['associations']['stock_availables']
                if isinstance(stock_availables, dict) and 'stock_available' in stock_availables:
                    stock_info = stock_availables['stock_available']
                    if isinstance(stock_info, dict):
                        stock_available_id = stock_info.get('id')
                    elif isinstance(stock_info, list) and len(stock_info) > 0:
                        stock_available_id = stock_info[0].get('id')
            
            if not stock_available_id:
                return False
            
            # Actualizar stock_available
            stock_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <stock_available>
        <id>{stock_available_id}</id>
        <quantity>{quantity}</quantity>
    </stock_available>
</prestashop>"""
            
            response = ps_service._make_request(
                f'stock_availables/{stock_available_id}',
                method='PUT',
                data=stock_xml
            )
            
            return True
            
        except Exception as e:
            print(f"Error updating PrestaShop stock: {e}")
            return False
