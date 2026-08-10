"""
Servicio para sincronizar categorías desde PrestaShop
"""

from typing import Dict, List, Optional
from datetime import datetime, timezone
import uuid

from services.prestashop_service import PrestashopAPIService
from utils import db


class CategorySyncService:
    """Servicio para sincronizar categorías jerárquicas desde PrestaShop"""
    
    def __init__(self, prestashop_service: PrestashopAPIService, account_id: str, store_name: str, integration_id: str = None, store_id: str = None):
        """
        Inicializar servicio de sincronización
        
        Args:
            prestashop_service: Instancia del servicio de PrestaShop
            account_id: ID de la cuenta (para multi-tenancy)
            store_name: Nombre de la tienda para identificar origen
            integration_id: ID de la integración PrestaShop
            store_id: ID de la tienda (para multi-tenant)
        """
        self.ps = prestashop_service
        self.account_id = account_id
        self.store_name = store_name
        self.integration_id = integration_id
        self.store_id = store_id
    
    async def sync_category_hierarchy(self, category_id: int) -> Optional[str]:
        """
        Sincronizar jerarquía completa de una categoría desde PrestaShop
        
        Args:
            category_id: ID de la categoría en PrestaShop
            
        Returns:
            ID local de la categoría sincronizada o None si falla
        """
        try:
            # Validar que la categoría existe primero
            category_exists = self.ps.get_category(category_id)
            if not category_exists:
                print(f"[CategorySync] Categoría {category_id} no existe en PrestaShop, saltando...")
                return None
            
            # Obtener jerarquía completa desde PrestaShop
            hierarchy = self.ps.get_category_hierarchy(category_id)
            
            if not hierarchy or len(hierarchy) == 0:
                print(f"[CategorySync] No se pudo obtener jerarquía para categoría {category_id}")
                return None
            
            print(f"[CategorySync] Sincronizando jerarquía de {len(hierarchy)} niveles para categoría {category_id}")
            
            # Sincronizar cada nivel de la jerarquía
            parent_local_id = None
            local_category_id = None
            
            for level_idx, ps_category in enumerate(hierarchy):
                # Buscar si la categoría ya existe localmente
                # Priorizar búsqueda por prestashop_id + integration_id (nuevo formato)
                # Fallback a external_id + store (formato legacy)
                query = {
                    'account_id': self.account_id,
                    'source': 'prestashop'
                }
                
                if self.integration_id and self.store_id:
                    # Nuevo formato: usar prestashop_id + integration_id
                    query['prestashop_id'] = ps_category['id']
                    query['store_id'] = self.store_id
                else:
                    # Legacy: usar external_id + store name
                    query['external_id'] = str(ps_category['id'])
                    query['store'] = self.store_name
                
                existing = await db.categories.find_one(query, {'_id': 0})
                
                if existing:
                    # Ya existe, usar su ID como padre para el siguiente nivel
                    local_category_id = existing['id']
                    parent_local_id = local_category_id
                    print(f"[CategorySync] Categoría '{ps_category['name']}' ya existe localmente (ID: {local_category_id})")
                else:
                    # Crear nueva categoría local
                    local_category_id = str(uuid.uuid4())
                    
                    category_doc = {
                        'id': local_category_id,
                        'name': ps_category['name'],
                        'parent_id': parent_local_id,
                        'level': level_idx,
                        'account_id': self.account_id,
                        'source': 'prestashop',
                        'store': self.store_name,  # Legacy compatibility
                        'external_id': str(ps_category['id']),  # Legacy compatibility
                        'created_at': datetime.now(timezone.utc).isoformat(),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Agregar campos nuevos si están disponibles
                    if self.integration_id:
                        category_doc['integration_id'] = self.integration_id
                        category_doc['prestashop_id'] = ps_category['id']
                    
                    if self.store_id:
                        category_doc['store_id'] = self.store_id
                    
                    await db.categories.insert_one(category_doc)
                    print(f"[CategorySync] ✅ Creada categoría '{ps_category['name']}' (nivel {level_idx}, ID local: {local_category_id})")
                    
                    parent_local_id = local_category_id
            
            return local_category_id
            
        except Exception as e:
            print(f"[CategorySync] ❌ Error sincronizando categoría {category_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    async def get_local_category_by_external_id(self, external_id: str) -> Optional[Dict]:
        """
        Obtener categoría local por su ID externo de PrestaShop
        
        Args:
            external_id: ID de la categoría en PrestaShop
            
        Returns:
            Categoría local o None
        """
        return await db.categories.find_one({
            'account_id': self.account_id,
            'external_id': external_id,
            'source': 'prestashop',
            'store': self.store_name
        }, {'_id': 0})
    
    async def update_category_from_prestashop(self, local_id: str, ps_data: Dict) -> bool:
        """
        Actualizar categoría local con datos de PrestaShop
        
        Args:
            local_id: ID local de la categoría
            ps_data: Datos de PrestaShop
            
        Returns:
            True si se actualizó correctamente
        """
        try:
            await db.categories.update_one(
                {
                    'account_id': self.account_id,
                    'id': local_id
                },
                {'$set': {
                    'name': ps_data['name'],
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }}
            )
            return True
        except Exception as e:
            print(f"[CategorySync] Error actualizando categoría {local_id}: {str(e)}")
            return False
