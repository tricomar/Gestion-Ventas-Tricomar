"""
Servicio especializado para sincronización bidireccional de stock con PrestaShop
Compatible con productos simples y combinaciones (id_product_attribute)
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from services.prestashop_service import PrestashopAPIService

logger = logging.getLogger(__name__)


class PrestashopStockSyncService:
    """
    Servicio de sincronización bidireccional de stock entre Negocio Feliz y PrestaShop
    
    Soporta:
    - Productos simples (id_product_attribute=0)
    - Combinaciones/variantes (id_product_attribute>0)
    - Multi-shop (id_shop)
    - Detección de conflictos
    """
    
    def __init__(self, ps_service: PrestashopAPIService):
        """
        Args:
            ps_service: Instancia configurada de PrestashopAPIService
        """
        self.ps_service = ps_service
    
    async def get_stock_availables(
        self,
        product_id: Optional[int] = None,
        attribute_id: Optional[int] = None,
        shop_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Obtener registros de stock_availables de PrestaShop
        
        Args:
            product_id: Filtrar por ID de producto
            attribute_id: Filtrar por ID de atributo/combinación
            shop_id: Filtrar por ID de tienda
            
        Returns:
            Lista de registros stock_available
        """
        try:
            params = {
                'display': 'full'
            }
            
            if product_id is not None:
                params['filter[id_product]'] = f'[{product_id}]'
            if attribute_id is not None:
                params['filter[id_product_attribute]'] = f'[{attribute_id}]'
            if shop_id is not None:
                params['filter[id_shop]'] = f'[{shop_id}]'
            
            response = self.ps_service._make_request('stock_availables', params=params)
            
            if 'stock_availables' not in response:
                return []
            
            stock_data = response['stock_availables']
            
            # Normalizar respuesta (puede ser dict o list)
            if isinstance(stock_data, dict):
                return [stock_data]
            elif isinstance(stock_data, list):
                return stock_data
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error obteniendo stock_availables: {e}")
            return []
    
    async def get_product_stock_mapping(
        self,
        product_id: int,
        shop_id: Optional[int] = None
    ) -> Dict[int, Dict[str, Any]]:
        """
        Obtener mapeo completo de stock para un producto (simple + todas sus combinaciones)
        
        Args:
            product_id: ID del producto en PrestaShop
            shop_id: ID de tienda (multi-shop)
            
        Returns:
            Dict con key=id_product_attribute, value=stock_info
            {
                0: {...},  # Producto simple o total
                15: {...}, # Combinación 1
                16: {...}  # Combinación 2
            }
        """
        stock_records = await self.get_stock_availables(
            product_id=product_id,
            shop_id=shop_id
        )
        
        mapping = {}
        for record in stock_records:
            attr_id = int(record.get('id_product_attribute', 0))
            mapping[attr_id] = {
                'stock_available_id': int(record.get('id')),
                'id_product': int(record.get('id_product')),
                'id_product_attribute': attr_id,
                'id_shop': int(record.get('id_shop', 1)),
                'quantity': int(record.get('quantity', 0)),
                'depends_on_stock': int(record.get('depends_on_stock', 0)),
                'out_of_stock': int(record.get('out_of_stock', 0))
            }
        
        return mapping
    
    async def update_stock_quantity(
        self,
        stock_available_id: int,
        product_id: int,
        attribute_id: int,
        shop_id: int,
        quantity: int,
        depends_on_stock: int = 0,
        out_of_stock: int = 0
    ) -> bool:
        """
        Actualizar cantidad de stock en PrestaShop usando GET → modificar → PUT
        
        Args:
            stock_available_id: ID del registro stock_available
            product_id: ID del producto
            attribute_id: ID de atributo (0 para producto simple)
            shop_id: ID de tienda
            quantity: Nueva cantidad (>= 0)
            depends_on_stock: 0=stock manual, 1=gestionado por otro sistema
            out_of_stock: Comportamiento cuando agotado
            
        Returns:
            True si se actualizó correctamente
        """
        if quantity < 0:
            raise ValueError("La cantidad no puede ser negativa")
        
        try:
            # 1. Obtener XML actual del registro
            xml_response = self.ps_service._make_request_xml(
                f'stock_availables/{stock_available_id}'
            )
            
            # 2. Parsear y modificar
            root = ET.fromstring(xml_response)
            stock_node = root.find('stock_available')
            
            if stock_node is None:
                logger.error(f"No se encontró nodo stock_available en respuesta XML")
                return False
            
            # 3. Actualizar campos (crítico: incluir id_shop para evitar bug multi-shop)
            fields_to_update = {
                'id': str(stock_available_id),
                'id_product': str(product_id),
                'id_product_attribute': str(attribute_id),
                'id_shop': str(shop_id),
                'quantity': str(quantity),
                'depends_on_stock': str(depends_on_stock),
                'out_of_stock': str(out_of_stock)
            }
            
            for field_name, field_value in fields_to_update.items():
                field_node = stock_node.find(field_name)
                if field_node is None:
                    field_node = ET.SubElement(stock_node, field_name)
                field_node.text = field_value
            
            # 4. Serializar y enviar PUT
            xml_payload = ET.tostring(root, encoding='utf-8', xml_declaration=True)
            
            self.ps_service._make_request(
                f'stock_availables/{stock_available_id}',
                method='PUT',
                data=xml_payload.decode('utf-8')
            )
            
            logger.info(
                f"Stock actualizado: product_id={product_id}, "
                f"attr={attribute_id}, shop={shop_id}, qty={quantity}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Error actualizando stock {stock_available_id}: {e}")
            return False
    
    async def detect_stock_conflicts(
        self,
        local_stocks: Dict[str, Any],
        prestashop_stocks: Dict[int, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detectar conflictos entre stock local y remoto
        
        Args:
            local_stocks: {sku: {"quantity": X, "product_id": Y, ...}}
            prestashop_stocks: resultado de get_product_stock_mapping
            
        Returns:
            Lista de conflictos detectados con detalles
        """
        conflicts = []
        
        for attr_id, ps_stock in prestashop_stocks.items():
            # Buscar correspondencia en local
            # (implementación depende de cómo NF mapea productos con PrestaShop)
            local_key = f"ps_{ps_stock['id_product']}_{attr_id}"
            
            if local_key in local_stocks:
                local_qty = local_stocks[local_key]['quantity']
                ps_qty = ps_stock['quantity']
                
                if local_qty != ps_qty:
                    conflicts.append({
                        'product_id': ps_stock['id_product'],
                        'attribute_id': attr_id,
                        'stock_available_id': ps_stock['stock_available_id'],
                        'local_quantity': local_qty,
                        'prestashop_quantity': ps_qty,
                        'difference': abs(local_qty - ps_qty),
                        'shop_id': ps_stock['id_shop']
                    })
        
        return conflicts
    
    async def sync_from_prestashop(
        self,
        account_id: str,
        integration_id: str,
        product_ids: Optional[List[int]] = None,
        shop_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Sincronizar stock desde PrestaShop hacia Negocio Feliz
        
        Args:
            account_id: ID de cuenta (tenant)
            integration_id: ID de integración PrestaShop
            product_ids: Lista de IDs de productos (None = todos)
            shop_id: ID de tienda PrestaShop
            
        Returns:
            Reporte de sincronización
        """
        from utils import db
        
        synced = 0
        conflicts = 0
        errors = []
        
        try:
            # Obtener todos los registros de stock o filtrados
            if product_ids:
                all_stocks = []
                for pid in product_ids:
                    stocks = await self.get_stock_availables(
                        product_id=pid,
                        shop_id=shop_id
                    )
                    all_stocks.extend(stocks)
            else:
                all_stocks = await self.get_stock_availables(shop_id=shop_id)
            
            for stock_record in all_stocks:
                try:
                    ps_product_id = int(stock_record['id_product'])
                    ps_attr_id = int(stock_record.get('id_product_attribute', 0))
                    quantity = int(stock_record.get('quantity', 0))
                    
                    # Buscar producto local correspondiente
                    query = {
                        'account_id': account_id,
                        'prestashop_id': ps_product_id,
                        'prestashop_integration_id': integration_id
                    }
                    
                    local_product = await db.products.find_one(query, {'_id': 0})
                    
                    if local_product:
                        # Verificar conflicto
                        local_stock = local_product.get('stock', 0)
                        if local_stock != quantity:
                            conflicts += 1
                        
                        # Actualizar stock local con source=prestashop
                        await db.products.update_one(
                            query,
                            {
                                '$set': {
                                    'stock': quantity,
                                    'last_stock_sync': datetime.now(timezone.utc).isoformat(),
                                    'stock_sync_source': 'prestashop'
                                }
                            }
                        )
                        synced += 1
                    
                except Exception as e:
                    errors.append({
                        'product_id': stock_record.get('id_product'),
                        'error': str(e)
                    })
            
            return {
                'success': True,
                'synced_count': synced,
                'conflicts_detected': conflicts,
                'errors': errors,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error en sync_from_prestashop: {e}")
            return {
                'success': False,
                'error': str(e),
                'synced_count': synced,
                'conflicts_detected': conflicts
            }
    
    async def sync_to_prestashop(
        self,
        account_id: str,
        integration_id: str,
        product_id: str,
        new_quantity: int,
        source: str = 'manual',
        shop_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Sincronizar stock desde Negocio Feliz hacia PrestaShop
        
        Args:
            account_id: ID de cuenta
            integration_id: ID de integración
            product_id: ID del producto local
            new_quantity: Nueva cantidad de stock
            source: Origen del cambio (pos, manual, sync_manual)
            shop_id: ID de tienda PrestaShop
            
        Returns:
            Resultado de sincronización
        """
        from utils import db
        
        try:
            # Obtener producto local
            product = await db.products.find_one({
                'account_id': account_id,
                'id': product_id
            }, {'_id': 0})
            
            if not product:
                return {'success': False, 'error': 'Producto no encontrado'}
            
            ps_product_id = product.get('prestashop_id')
            if not ps_product_id:
                return {'success': False, 'error': 'Producto no está sincronizado con PrestaShop'}
            
            # Obtener mapping de stock (incluye combinaciones)
            stock_mapping = await self.get_product_stock_mapping(
                product_id=ps_product_id,
                shop_id=shop_id
            )
            
            if not stock_mapping:
                return {'success': False, 'error': 'No se encontró stock_available en PrestaShop'}
            
            # Para producto simple, usar attr_id=0
            # TODO: soportar combinaciones cuando el modelo local las implemente completamente
            target_attr_id = 0
            
            if target_attr_id not in stock_mapping:
                return {
                    'success': False,
                    'error': f'No existe stock_available para attr_id={target_attr_id}'
                }
            
            stock_info = stock_mapping[target_attr_id]
            
            # Actualizar en PrestaShop
            success = await self.update_stock_quantity(
                stock_available_id=stock_info['stock_available_id'],
                product_id=ps_product_id,
                attribute_id=target_attr_id,
                shop_id=stock_info['id_shop'],
                quantity=new_quantity,
                depends_on_stock=stock_info['depends_on_stock'],
                out_of_stock=stock_info['out_of_stock']
            )
            
            if success:
                # Actualizar timestamp local
                await db.products.update_one(
                    {'account_id': account_id, 'id': product_id},
                    {
                        '$set': {
                            'last_stock_sync': datetime.now(timezone.utc).isoformat(),
                            'stock_sync_source': source
                        }
                    }
                )
                
                return {
                    'success': True,
                    'message': 'Stock sincronizado correctamente',
                    'product_id': ps_product_id,
                    'quantity': new_quantity,
                    'source': source
                }
            else:
                return {'success': False, 'error': 'Error al actualizar stock en PrestaShop'}
                
        except Exception as e:
            logger.error(f"Error en sync_to_prestashop: {e}")
            return {'success': False, 'error': str(e)}
