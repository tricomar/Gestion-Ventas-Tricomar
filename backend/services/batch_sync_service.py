"""
Servicio de Sincronización por Lotes Profesional
Maneja sincronización de productos de PrestaShop en lotes pequeños con:
- Progreso en tiempo real
- Pausas entre lotes
- Recuperación ante fallos
- Reporte detallado de errores
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
import json

# Configurar logging
logger = logging.getLogger('batch_sync')
logger.setLevel(logging.INFO)

class BatchSyncService:
    """Servicio para sincronizar productos en lotes pequeños"""
    
    def __init__(self, ps_service, db, integration_id: str, account_id: str, store_id: str, job_id: str = None):
        self.ps_service = ps_service
        self.db = db
        self.integration_id = integration_id
        self.account_id = account_id
        self.store_id = store_id
        self.job_id = job_id  # ✅ Agregar job_id para tracking preciso
        self.sync_log_path = f'/app/sync_reports/sync_{integration_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        
    async def sync_products_in_batches(
        self,
        batch_size: int = 100,
        pause_seconds: float = 0.5,
        max_products: int = None
    ) -> Dict[str, Any]:
        """
        Sincronizar productos en lotes pequeños con pausas
        
        Args:
            batch_size: Tamaño de cada lote (default: 100)
            pause_seconds: Pausa entre lotes en segundos (default: 0.5)
            max_products: Máximo de productos a sincronizar (None = todos)
            
        Returns:
            Diccionario con resultados de la sincronización
        """
        logger.info(f"Iniciando sincronización por lotes: batch_size={batch_size}, pause={pause_seconds}s")
        
        start_time = datetime.now(timezone.utc)
        
        # Estructuras para tracking
        result = {
            'status': 'running',
            'total_products': 0,
            'synced_products': 0,
            'failed_products': 0,
            'skipped_products': 0,
            'current_batch': 0,
            'total_batches': 0,
            'progress_percentage': 0,
            'errors': [],
            'incomplete_data': [],
            'start_time': start_time.isoformat(),
            'end_time': None,
            'duration_seconds': 0
        }
        
        try:
            # 1. Obtener manufacturers y categorías (pre-carga)
            logger.info("Pre-cargando manufacturers y categorías...")
            manufacturers_map = await self._load_manufacturers()
            categories_map = await self._load_categories()
            logger.info(f"Pre-carga completa: {len(manufacturers_map)} marcas, {len(categories_map)} categorías")
            
            # 2. Determinar total de productos disponibles
            first_batch = self.ps_service.get_products(limit=1, offset=0)
            if not first_batch:
                result['status'] = 'completed'
                result['message'] = 'No hay productos disponibles en PrestaShop'
                return result
            
            # Estimar total (PrestaShop no da el total exactamente, así que iteramos)
            logger.info("Calculando total de productos disponibles...")
            total_available = await self._count_available_products(batch_size)
            
            if max_products:
                total_to_sync = min(total_available, max_products)
            else:
                total_to_sync = total_available
            
            total_batches = (total_to_sync + batch_size - 1) // batch_size
            
            result['total_products'] = total_to_sync
            result['total_batches'] = total_batches
            
            logger.info(f"Total productos a sincronizar: {total_to_sync} en {total_batches} lotes")
            
            # 3. Sincronizar por lotes usando filtro por ID (más confiable que offset)
            last_id = 0
            batch_num = 0
            
            while result['synced_products'] + result['failed_products'] < total_to_sync:
                batch_num += 1
                result['current_batch'] = batch_num
                
                logger.info(f"=== LOTE {batch_num}/{total_batches} ===")
                
                try:
                    # Obtener lote de productos usando filtro por ID
                    batch_products = self.ps_service.get_products_by_id_range(
                        min_id=last_id,
                        limit=batch_size
                    )
                    
                    if not batch_products:
                        logger.info("No hay más productos disponibles")
                        break
                    
                    logger.info(f"Obtenidos {len(batch_products)} productos en este lote (desde ID > {last_id})")
                    
                    # Procesar cada producto del lote
                    for ps_prod in batch_products:
                        try:
                            sync_result = await self._sync_single_product(
                                ps_prod,
                                manufacturers_map,
                                categories_map
                            )
                            
                            if sync_result['success']:
                                result['synced_products'] += 1
                            else:
                                result['failed_products'] += 1
                                result['errors'].append(sync_result['error'])
                            
                            # Registrar datos incompletos
                            if sync_result.get('incomplete_fields'):
                                result['incomplete_data'].append({
                                    'product_id': ps_prod.get('id'),
                                    'product_name': ps_prod.get('name'),
                                    'missing_fields': sync_result['incomplete_fields']
                                })
                        
                        except Exception as e:
                            result['failed_products'] += 1
                            result['errors'].append({
                                'product_id': ps_prod.get('id'),
                                'error': str(e)
                            })
                            logger.error(f"Error procesando producto {ps_prod.get('id')}: {e}")
                    
                    # Actualizar progreso
                    result['progress_percentage'] = int(
                        ((result['synced_products'] + result['failed_products']) / total_to_sync) * 100
                    )
                    
                    # Actualizar estado en DB (para que el frontend pueda consultarlo)
                    await self._update_sync_progress(result)
                    
                    # Actualizar last_id para el siguiente lote
                    if batch_products:
                        last_id = max(int(p.get('id', 0)) for p in batch_products)
                        logger.info(f"Último ID procesado: {last_id}")
                    
                    # Pausa entre lotes para no sobrecargar PrestaShop
                    if batch_num < total_batches:
                        logger.info(f"Pausa de {pause_seconds}s antes del siguiente lote...")
                        await asyncio.sleep(pause_seconds)
                    
                except Exception as e:
                    logger.error(f"Error en lote {batch_num}: {e}")
                    result['errors'].append({
                        'batch': batch_num,
                        'error': str(e)
                    })
                    # Continuar con el siguiente lote incrementando last_id
                    if batch_products:
                        last_id = max(int(p.get('id', last_id)) for p in batch_products)
            
            # 4. Finalizar
            end_time = datetime.now(timezone.utc)
            result['end_time'] = end_time.isoformat()
            result['duration_seconds'] = (end_time - start_time).total_seconds()
            result['status'] = 'completed'
            
            # 5. Generar reporte
            await self._generate_report(result)
            
            logger.info(f"Sincronización completada: {result['synced_products']} exitosos, {result['failed_products']} fallidos")
            
            return result
            
        except Exception as e:
            logger.error(f"Error fatal en sincronización: {e}", exc_info=True)
            result['status'] = 'error'
            result['errors'].append({'fatal_error': str(e)})
            return result
    
    async def _load_manufacturers(self) -> Dict[int, str]:
        """Pre-cargar manufacturers"""
        manufacturers_map = {}
        try:
            manufacturers = self.ps_service.get_manufacturers(limit=500)
            manufacturers_map = {m['id']: m['name'] for m in manufacturers}
        except Exception as e:
            logger.error(f"Error cargando manufacturers: {e}")
        return manufacturers_map
    
    async def _load_categories(self) -> Dict[int, str]:
        """Pre-cargar categorías locales"""
        categories_map = {}
        try:
            local_categories = await self.db.categories.find(
                {'account_id': self.account_id},
                {'_id': 0, 'prestashop_id': 1, 'name': 1}
            ).to_list(1000)
            categories_map = {
                int(c['prestashop_id']): c['name']
                for c in local_categories
                if c.get('prestashop_id')
            }
        except Exception as e:
            logger.error(f"Error cargando categorías: {e}")
        return categories_map
    
    async def _count_available_products(self, batch_size: int) -> int:
        """Contar productos disponibles en PrestaShop usando filtro por ID"""
        try:
            logger.info("Consultando total de productos en PrestaShop...")
            
            # PrestaShop limita a ~1000 con offset, usar filtro por ID
            count = 0
            last_id = 0
            max_iterations = 100  # Protección contra loops infinitos
            
            for i in range(max_iterations):
                # Usar get_products_by_id_range que filtra por ID
                batch = self.ps_service.get_products_by_id_range(
                    min_id=last_id,
                    limit=batch_size
                )
                
                if not batch or len(batch) == 0:
                    break
                    
                count += len(batch)
                
                # Obtener el último ID del batch
                last_id = max(int(p.get('id', 0)) for p in batch)
                
                logger.info(f"Conteo parcial: {count} productos (último ID: {last_id})")
                
                # Si recibimos menos del batch_size, llegamos al final
                if len(batch) < batch_size:
                    break
            
            logger.info(f"Total de productos detectados en PrestaShop: {count}")
            return count
            
        except Exception as e:
            logger.error(f"Error contando productos: {e}")
            return batch_size * 10  # Fallback conservador
    
    async def _sync_single_product(
        self,
        ps_prod: Dict[str, Any],
        manufacturers_map: Dict[int, str],
        categories_map: Dict[int, str]
    ) -> Dict[str, Any]:
        """Sincronizar un solo producto con datos completos"""
        
        prod_id = int(ps_prod.get('id', 0))
        if prod_id <= 0:
            return {'success': False, 'error': 'ID inválido'}
        
        incomplete_fields = []
        
        try:
            # 1. Nombre
            name = self._extract_name(ps_prod, prod_id)
            
            # 2. SKU
            sku = ps_prod.get('reference', f"PS-{prod_id}-{str(uuid4())[:8]}")
            
            # 3. Precio (entero)
            price = float(ps_prod.get('price', 0))
            sale_price = round(price)
            
            # 4. Marca
            id_manufacturer = int(ps_prod.get('id_manufacturer', 0))
            brand = manufacturers_map.get(id_manufacturer, None)
            if not brand and id_manufacturer > 0:
                incomplete_fields.append('brand')
            
            # 5. Categoría
            id_category_default = int(ps_prod.get('id_category_default', 0))
            category = categories_map.get(id_category_default, None)
            if not category and id_category_default > 0:
                incomplete_fields.append('category')
            
            # 6. Stock
            stock_quantity = ps_prod.get('quantity', 0)
            if isinstance(stock_quantity, dict):
                stock_quantity = int(stock_quantity.get('quantity', 0))
            else:
                stock_quantity = int(stock_quantity) if stock_quantity else 0
            
            # 7. Estado de publicación
            active = ps_prod.get('active', '0')
            ecommerce_active = active == '1' or active == 1 or active is True
            
            # 8. Descripción corta (resumen)
            summary = self._extract_multilang_field(ps_prod.get('description_short', ''))
            if not summary:
                incomplete_fields.append('summary')
            
            # 9. Descripción larga
            description = self._extract_multilang_field(ps_prod.get('description', ''))
            if not description:
                incomplete_fields.append('description')
            
            # 10. Peso
            weight = float(ps_prod.get('weight', 0)) if ps_prod.get('weight') else None
            
            # 11. Imagen principal
            image_url = None
            try:
                images = self.ps_service.get_product_images(prod_id)
                if images and len(images) > 0:
                    image_url = images[0].get('url')
                else:
                    incomplete_fields.append('image')
            except Exception:
                incomplete_fields.append('image')
            
            # 12. Combinaciones (si las tiene)
            combinations = []
            try:
                combs = self.ps_service.get_product_combinations(prod_id)
                for comb in combs:
                    combinations.append({
                        'id': int(comb.get('id', 0)),
                        'reference': comb.get('reference'),
                        'quantity': int(comb.get('quantity', 0)),
                        'price': float(comb.get('price', 0)),
                        'attributes': []  # Simplificado por ahora
                    })
            except Exception:
                pass  # Las combinaciones son opcionales
            
            # Construir datos del producto
            product_data = {
                'name': name,
                'sku': sku,
                'cost_price': 0,
                'sale_price': sale_price,
                'store_id': self.store_id,
                'category': category,
                'brand': brand,
                'stock': stock_quantity,
                'ecommerce_active': ecommerce_active,
                'expiry_date': None,
                'prestashop_id': prod_id,
                'prestashop_integration_id': self.integration_id,
                'account_id': self.account_id,
                'image_url': image_url,
                'summary': summary,
                'description': description,
                'weight': weight,
                'combinations': combinations if combinations else []
            }
            
            # Buscar producto existente
            local_product = await self.db.products.find_one(
                {'sku': sku, 'account_id': self.account_id},
                {'_id': 0}
            )
            
            if local_product:
                await self.db.products.update_one(
                    {'sku': sku, 'account_id': self.account_id},
                    {'$set': product_data}
                )
            else:
                product_data['id'] = str(uuid4())
                product_data['created_at'] = datetime.now(timezone.utc).isoformat()
                await self.db.products.insert_one(product_data)
            
            return {
                'success': True,
                'product_id': prod_id,
                'incomplete_fields': incomplete_fields
            }
            
        except Exception as e:
            return {
                'success': False,
                'product_id': prod_id,
                'error': str(e)
            }
    
    def _extract_name(self, ps_prod: Dict, prod_id: int) -> str:
        """Extraer nombre del producto"""
        name = ps_prod.get('name', {})
        if isinstance(name, dict):
            if 'language' in name:
                lang = name['language']
                if isinstance(lang, list) and len(lang) > 0:
                    return lang[0].get('value', f'Producto {prod_id}')
                elif isinstance(lang, dict):
                    return lang.get('value', f'Producto {prod_id}')
        return str(name) if name else f'Producto {prod_id}'
    
    def _extract_multilang_field(self, field: Any) -> Optional[str]:
        """Extraer campo multi-idioma"""
        if isinstance(field, dict):
            if 'language' in field:
                lang = field['language']
                if isinstance(lang, list) and len(lang) > 0:
                    return lang[0].get('value', '')
                elif isinstance(lang, dict):
                    return lang.get('value', '')
        return str(field) if field else None
    
    async def _update_sync_progress(self, result: Dict[str, Any]):
        """Actualizar progreso en DB para que el frontend pueda consultarlo"""
        try:
            # Usar job_id si está disponible, sino integration_id como fallback
            query_filter = {'id': self.job_id} if self.job_id else {'integration_id': self.integration_id}
            
            await self.db.sync_progress.update_one(
                query_filter,
                {
                    '$set': {
                        'integration_id': self.integration_id,
                        'account_id': self.account_id,
                        'status': result['status'],
                        'progress_percentage': result['progress_percentage'],
                        'current_batch': result['current_batch'],
                        'total_batches': result['total_batches'],
                        'synced_products': result['synced_products'],
                        'failed_products': result['failed_products'],
                        'total_products': result['total_products'],
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=False  # No crear si no existe, debe existir desde el inicio
            )
        except Exception as e:
            logger.error(f"Error actualizando progreso: {e}")
    
    async def _generate_report(self, result: Dict[str, Any]):
        """Generar reporte detallado en JSON"""
        try:
            import os
            os.makedirs('/app/sync_reports', exist_ok=True)
            
            report = {
                'integration_id': self.integration_id,
                'account_id': self.account_id,
                'store_id': self.store_id,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'summary': {
                    'total_products': result['total_products'],
                    'synced_successfully': result['synced_products'],
                    'failed': result['failed_products'],
                    'duration_seconds': result['duration_seconds']
                },
                'errors': result['errors'],
                'incomplete_data': result['incomplete_data']
            }
            
            with open(self.sync_log_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Reporte generado: {self.sync_log_path}")
            
            # Guardar referencia en DB
            await self.db.sync_reports.insert_one({
                'id': str(uuid4()),
                'integration_id': self.integration_id,
                'account_id': self.account_id,
                'file_path': self.sync_log_path,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'summary': report['summary']
            })
            
        except Exception as e:
            logger.error(f"Error generando reporte: {e}")
