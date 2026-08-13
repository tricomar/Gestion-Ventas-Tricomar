"""
Servicio especializado para sincronización automática de órdenes desde PrestaShop
Implementa Fase 3: Órdenes Automáticas vía Webhook

Funcionalidades:
- Sincronización automática de órdenes
- Creación automática de productos si no existen
- Reserva de stock al crear orden
- Liberación de stock al cancelar orden
- Integración con estados de PrestaShop
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
from services.prestashop_service import PrestashopAPIService

logger = logging.getLogger(__name__)


class PrestashopOrderService:
    """
    Servicio de sincronización automática de órdenes con gestión de stock
    """
    
    def __init__(self, ps_service: PrestashopAPIService, db):
        """
        Args:
            ps_service: Instancia configurada de PrestashopAPIService
            db: Motor database instance
        """
        self.ps_service = ps_service
        self.db = db
    
    async def sync_order_with_products(
        self,
        order_id: int,
        integration_id: str,
        account_id: str,
        store_id: str,
        store_code: str = 'A'
    ) -> Dict[str, Any]:
        """
        Sincronizar orden completa con productos, stock y estados
        
        Args:
            order_id: ID de orden en PrestaShop
            integration_id: ID de integración
            account_id: ID de cuenta (tenant)
            store_id: ID de tienda local
            store_code: Código de tienda (A, B, C...)
            
        Returns:
            Resultado de sincronización con detalles
        """
        try:
            # 1. Obtener detalles de orden de PrestaShop
            ps_order = self.ps_service.get_order_details(order_id)
            if not ps_order:
                return {
                    'success': False,
                    'error': f'Orden {order_id} no encontrada en PrestaShop'
                }
            
            # 2. Obtener productos de la orden (order rows)
            order_rows = self._get_order_products(order_id)
            
            # 3. Verificar/crear productos localmente
            products_result = await self._ensure_products_exist(
                order_rows,
                integration_id,
                account_id,
                store_id,
                store_code
            )
            
            # 4. Verificar si la orden ya existe localmente
            existing_order = await self.db.prestashop_orders.find_one({
                'account_id': account_id,
                'prestashop_id': order_id
            }, {'_id': 0})
            
            # 5. Preparar datos de orden
            order_data = {
                'account_id': account_id,
                'store_id': store_id,
                'integration_id': integration_id,
                'prestashop_id': order_id,
                'reference': ps_order.get('reference', f'PS-{order_id}'),
                'customer_id': int(ps_order.get('id_customer', 0)),
                'total_paid': float(ps_order.get('total_paid', 0)),
                'total_products': float(ps_order.get('total_products', 0)),
                'total_shipping': float(ps_order.get('total_shipping', 0)),
                'current_state': int(ps_order.get('current_state', 0)),
                'payment_method': ps_order.get('payment', 'Unknown'),
                'date_add': ps_order.get('date_add'),
                'date_upd': ps_order.get('date_upd'),
                'order_rows': order_rows,
                'products_created_auto': products_result.get('products_created', []),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Agregar información de envío/entrega
            if ps_order.get('id_carrier'):
                try:
                    carrier_id = int(ps_order['id_carrier'])
                    carrier_info = self.ps_service._make_request(f'carriers/{carrier_id}')
                    if carrier_info and 'carrier' in carrier_info:
                        order_data['carrier_name'] = carrier_info['carrier'].get('name', '')
                except Exception as e:
                    logger.warning(f"No se pudo obtener información del carrier: {e}")
            
            # Agregar dirección de entrega
            if ps_order.get('id_address_delivery'):
                try:
                    address_id = int(ps_order['id_address_delivery'])
                    address_info = self.ps_service._make_request(f'addresses/{address_id}')
                    if address_info and 'address' in address_info:
                        addr = address_info['address']
                        order_data['delivery_address'] = {
                            'address1': addr.get('address1', ''),
                            'address2': addr.get('address2', ''),
                            'city': addr.get('city', ''),
                            'postcode': addr.get('postcode', ''),
                            'country': addr.get('country', ''),
                            'phone': addr.get('phone', ''),
                            'phone_mobile': addr.get('phone_mobile', '')
                        }
                except Exception as e:
                    logger.warning(f"No se pudo obtener dirección de entrega: {e}")
            
            # 6. Gestión de stock según estado
            stock_action = None
            previous_state = existing_order.get('current_state') if existing_order else None
            current_state = order_data['current_state']
            
            if not existing_order:
                # Orden nueva: reservar stock
                stock_action = await self._reserve_stock(
                    order_rows,
                    account_id,
                    order_id
                )
                order_data['stock_reserved'] = True
                order_data['stock_reserved_at'] = datetime.now(timezone.utc).isoformat()
            elif previous_state != current_state:
                # Estado cambió: verificar si es cancelación
                if self._is_cancelled_state(current_state):
                    # Liberar stock reservado
                    stock_action = await self._release_stock(
                        order_rows,
                        account_id,
                        order_id
                    )
                    order_data['stock_reserved'] = False
                    order_data['stock_released_at'] = datetime.now(timezone.utc).isoformat()
            
            # 7. Guardar/actualizar orden
            if existing_order:
                await self.db.prestashop_orders.update_one(
                    {'account_id': account_id, 'prestashop_id': order_id},
                    {'$set': order_data}
                )
            else:
                order_data['id'] = str(uuid4())
                order_data['created_at'] = datetime.now(timezone.utc).isoformat()
                await self.db.prestashop_orders.insert_one(order_data)
            
            return {
                'success': True,
                'order_id': order_id,
                'reference': order_data['reference'],
                'products_created': len(products_result.get('products_created', [])),
                'stock_action': stock_action,
                'state': current_state
            }
            
        except Exception as e:
            logger.error(f"Error syncing order {order_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_order_products(self, order_id: int) -> List[Dict[str, Any]]:
        """
        Obtener productos de una orden desde PrestaShop
        
        Returns:
            Lista de productos con cantidad, precio, etc.
        """
        try:
            # PrestaShop API: order details incluyen order_rows
            order_details = self.ps_service.get_order_details(order_id)
            if not order_details:
                return []
            
            # Parsear associations -> order_rows
            associations = order_details.get('associations', {})
            order_rows_raw = associations.get('order_rows', [])
            
            # Normalizar a lista
            if isinstance(order_rows_raw, dict):
                order_rows_raw = [order_rows_raw]
            
            order_rows = []
            for row in order_rows_raw:
                order_rows.append({
                    'product_id': int(row.get('product_id', 0)),
                    'product_name': row.get('product_name', ''),
                    'product_reference': row.get('product_reference', ''),
                    'product_quantity': int(row.get('product_quantity', 0)),
                    'unit_price_tax_incl': float(row.get('unit_price_tax_incl', 0)),
                    'unit_price_tax_excl': float(row.get('unit_price_tax_excl', 0))
                })
            
            return order_rows
            
        except Exception as e:
            logger.error(f"Error getting order products: {e}")
            return []
    
    async def _ensure_products_exist(
        self,
        order_rows: List[Dict[str, Any]],
        integration_id: str,
        account_id: str,
        store_id: str,
        store_code: str
    ) -> Dict[str, Any]:
        """
        Verificar que todos los productos de la orden existen localmente
        Si no existen, crearlos automáticamente con flag de revisión
        
        Returns:
            Dict con productos creados y actualizados
        """
        products_created = []
        products_updated = []
        
        for row in order_rows:
            ps_product_id = row['product_id']
            
            # Buscar producto local
            local_product = await self.db.products.find_one({
                'account_id': account_id,
                'prestashop_id': ps_product_id
            }, {'_id': 0})
            
            if not local_product:
                # Producto no existe: crear automáticamente
                product_data = {
                    'id': str(uuid4()),
                    'account_id': account_id,
                    'store_id': store_id,
                    'name': row['product_name'] or f"Producto PS-{ps_product_id}",
                    'sku': row['product_reference'] or f"PS-{ps_product_id}",
                    'sale_price': row['unit_price_tax_incl'],
                    'cost_price': row['unit_price_tax_excl'],
                    'stock': 0,  # Stock inicial 0, se ajustará por orden
                    'store': store_code,
                    'prestashop_id': ps_product_id,
                    'prestashop_integration_id': integration_id,
                    'auto_created': True,  # FLAG de revisión
                    'auto_created_at': datetime.now(timezone.utc).isoformat(),
                    'auto_created_from_order': True,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'category': 'Sin categoría'
                }
                
                await self.db.products.insert_one(product_data)
                products_created.append({
                    'id': product_data['id'],
                    'name': product_data['name'],
                    'sku': product_data['sku'],
                    'prestashop_id': ps_product_id
                })
                
                logger.info(f"✅ Producto auto-creado: {product_data['name']} (PS ID: {ps_product_id})")
            else:
                # Producto existe: opcionalmente actualizar precio
                products_updated.append(local_product['id'])
        
        return {
            'products_created': products_created,
            'products_updated': products_updated
        }
    
    async def _reserve_stock(
        self,
        order_rows: List[Dict[str, Any]],
        account_id: str,
        order_id: int
    ) -> Dict[str, Any]:
        """
        Reservar stock para los productos de una orden
        Reduce stock disponible según cantidad ordenada
        
        Returns:
            Resultado de reserva de stock
        """
        reserved = []
        
        for row in order_rows:
            ps_product_id = row['product_id']
            quantity = row['product_quantity']
            
            # Buscar producto local
            product = await self.db.products.find_one({
                'account_id': account_id,
                'prestashop_id': ps_product_id
            }, {'_id': 0})
            
            if product:
                current_stock = product.get('stock', 0)
                new_stock = max(0, current_stock - quantity)
                
                # Actualizar stock
                await self.db.products.update_one(
                    {'account_id': account_id, 'prestashop_id': ps_product_id},
                    {
                        '$set': {
                            'stock': new_stock,
                            'last_stock_change': datetime.now(timezone.utc).isoformat(),
                            'last_stock_change_reason': f'order_reserve_{order_id}'
                        }
                    }
                )
                
                reserved.append({
                    'product_id': product['id'],
                    'product_name': product['name'],
                    'quantity_reserved': quantity,
                    'stock_before': current_stock,
                    'stock_after': new_stock
                })
                
                logger.info(f"📦 Stock reservado: {product['name']} - {quantity} unidades (orden {order_id})")
        
        return {
            'action': 'reserve',
            'products': reserved,
            'total_items': len(reserved)
        }
    
    async def _release_stock(
        self,
        order_rows: List[Dict[str, Any]],
        account_id: str,
        order_id: int
    ) -> Dict[str, Any]:
        """
        Liberar stock reservado cuando una orden se cancela
        Devuelve stock a productos
        
        Returns:
            Resultado de liberación de stock
        """
        released = []
        
        for row in order_rows:
            ps_product_id = row['product_id']
            quantity = row['product_quantity']
            
            # Buscar producto local
            product = await self.db.products.find_one({
                'account_id': account_id,
                'prestashop_id': ps_product_id
            }, {'_id': 0})
            
            if product:
                current_stock = product.get('stock', 0)
                new_stock = current_stock + quantity
                
                # Devolver stock
                await self.db.products.update_one(
                    {'account_id': account_id, 'prestashop_id': ps_product_id},
                    {
                        '$set': {
                            'stock': new_stock,
                            'last_stock_change': datetime.now(timezone.utc).isoformat(),
                            'last_stock_change_reason': f'order_cancel_{order_id}'
                        }
                    }
                )
                
                released.append({
                    'product_id': product['id'],
                    'product_name': product['name'],
                    'quantity_released': quantity,
                    'stock_before': current_stock,
                    'stock_after': new_stock
                })
                
                logger.info(f"♻️ Stock liberado: {product['name']} + {quantity} unidades (orden {order_id} cancelada)")
        
        return {
            'action': 'release',
            'products': released,
            'total_items': len(released)
        }
    
    def _is_cancelled_state(self, state_id: int) -> bool:
        """
        Determinar si un estado representa orden cancelada
        
        Estados comunes de cancelación en PrestaShop:
        - 6: Cancelado
        - 7: Reembolsado
        - 8: Error de pago
        
        Returns:
            True si el estado indica cancelación
        """
        cancelled_states = [6, 7, 8]
        return state_id in cancelled_states
    
    def _is_payment_accepted_state(self, state_id: int) -> bool:
        """
        Determinar si un estado representa pago aceptado (venta completa)
        
        Estados comunes de pago aceptado:
        - 2: Pago aceptado
        - 11: Pago remoto aceptado
        - 12: Pago Webpay aceptado
        
        Returns:
            True si el estado indica pago aceptado
        """
        payment_accepted_states = [2, 11, 12]
        return state_id in payment_accepted_states
    
    def _is_delivered_state(self, state_id: int) -> bool:
        """
        Determinar si un estado representa entrega completada
        
        Estado común:
        - 5: Entregado
        
        Returns:
            True si el estado indica entrega completa
        """
        return state_id == 5
