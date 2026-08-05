"""
Endpoint de diagnóstico para debugging de PrestaShop
"""

from fastapi import APIRouter, Depends, HTTPException
from models.users import User
from utils import get_current_user, db
from services.prestashop_service import PrestashopAPIService
import json

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/prestashop/{integration_id}/category/{category_id}")
async def debug_prestashop_category(
    integration_id: str,
    category_id: int,
    current_user: User = Depends(get_current_user)
):
    """Debug: Ver respuesta raw de PrestaShop para una categoría"""
    
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        {'id': integration_id, 'account_id': current_user.account_id},
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear servicio
    ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
    
    try:
        # Obtener categoría
        category = ps_service.get_category(category_id)
        
        # Extraer nombre usando el método interno
        name = ps_service._extract_multilang_field(category.get('name', '')) if category else None
        
        # Obtener jerarquía
        hierarchy = ps_service.get_category_hierarchy(category_id)
        
        return {
            "success": True,
            "category_id": category_id,
            "raw_response": category,
            "extracted_name": name,
            "hierarchy": hierarchy,
            "hierarchy_count": len(hierarchy)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "category_id": category_id
        }


@router.get("/prestashop/{integration_id}/test-categories")
async def debug_test_categories(
    integration_id: str,
    current_user: User = Depends(get_current_user)
):
    """Debug: Listar primeras categorías de PrestaShop"""
    
    # Obtener integración
    integration = await db.prestashop_integrations.find_one(
        {'id': integration_id, 'account_id': current_user.account_id},
        {'_id': 0}
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada")
    
    # Crear servicio
    ps_service = PrestashopAPIService(integration['shop_url'], integration['api_key'])
    
    try:
        # Obtener primeras 10 categorías
        categories = ps_service.get_categories(limit=10)
        
        result = []
        for cat in categories:
            cat_id = int(cat.get('id', 0))
            name = ps_service._extract_multilang_field(cat.get('name', ''))
            parent_id = int(cat.get('id_parent', 0))
            
            result.append({
                'id': cat_id,
                'name': name,
                'id_parent': parent_id,
                'level_depth': int(cat.get('level_depth', 0))
            })
        
        return {
            "success": True,
            "total": len(result),
            "categories": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
