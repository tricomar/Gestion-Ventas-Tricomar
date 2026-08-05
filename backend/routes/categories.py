"""
Router para gestión de categorías jerárquicas de productos
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from models.categories import Category, CategoryCreate, CategoryUpdate
from models.users import User
from utils import db, get_current_user
from middleware.tenant import get_tenant_filter, add_account_id_to_document

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    """Obtener todas las categorías del tenant"""
    tenant_filter = get_tenant_filter(current_user.dict())
    
    categories = await db.categories.find(
        tenant_filter,
        {'_id': 0}
    ).sort('name', 1).to_list(1000)
    
    # Convertir strings de fecha a datetime si es necesario
    for cat in categories:
        if isinstance(cat.get('created_at'), str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at'])
        if isinstance(cat.get('updated_at'), str):
            cat['updated_at'] = datetime.fromisoformat(cat['updated_at'])
    
    return [Category(**cat) for cat in categories]


@router.post("", response_model=Category)
async def create_category(
    category_input: CategoryCreate,
    current_user: User = Depends(get_current_user)
):
    """Crear nueva categoría"""
    
    # Validar que el nombre no esté vacío
    if not category_input.name.strip():
        raise HTTPException(status_code=400, detail="El nombre de la categoría no puede estar vacío")
    
    # Si tiene parent_id, verificar que exista y calcular nivel
    level = 0
    if category_input.parent_id:
        tenant_filter = get_tenant_filter(current_user.dict())
        parent = await db.categories.find_one(
            {**tenant_filter, 'id': category_input.parent_id},
            {'_id': 0}
        )
        
        if not parent:
            raise HTTPException(status_code=404, detail="Categoría padre no encontrada")
        
        level = parent.get('level', 0) + 1
        
        # Validar máximo 4 niveles (0, 1, 2, 3)
        if level > 3:
            raise HTTPException(
                status_code=400,
                detail="Se ha alcanzado el máximo de 4 niveles de profundidad"
            )
    
    # Crear nueva categoría
    category = Category(
        id=str(uuid.uuid4()),
        name=category_input.name.strip(),
        parent_id=category_input.parent_id,
        level=level,
        account_id=current_user.account_id
    )
    
    # Guardar en base de datos
    doc = category.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.categories.insert_one(doc)
    
    return category


@router.put("/{category_id}", response_model=Category)
async def update_category(
    category_id: str,
    category_input: CategoryUpdate,
    current_user: User = Depends(get_current_user)
):
    """Actualizar nombre de categoría"""
    
    if not category_input.name.strip():
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    
    # Verificar que la categoría existe y pertenece al tenant
    tenant_filter = get_tenant_filter(current_user.dict())
    existing = await db.categories.find_one(
        {**tenant_filter, 'id': category_id},
        {'_id': 0}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Actualizar
    await db.categories.update_one(
        {**tenant_filter, 'id': category_id},
        {'$set': {
            'name': category_input.name.strip(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Obtener categoría actualizada
    updated = await db.categories.find_one(
        {**tenant_filter, 'id': category_id},
        {'_id': 0}
    )
    
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    
    return Category(**updated)


@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user)
):
    """Eliminar categoría (solo si no tiene hijos)"""
    
    tenant_filter = get_tenant_filter(current_user.dict())
    
    # Verificar que existe
    existing = await db.categories.find_one(
        {**tenant_filter, 'id': category_id},
        {'_id': 0}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar que no tiene categorías hijas
    children = await db.categories.find_one(
        {**tenant_filter, 'parent_id': category_id},
        {'_id': 0}
    )
    
    if children:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una categoría que tiene subcategorías. Elimine primero las subcategorías."
        )
    
    # Verificar que no tiene productos asignados
    products_count = await db.products.count_documents(
        {**tenant_filter, 'category': existing['name']}
    )
    
    if products_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar la categoría porque tiene {products_count} productos asignados"
        )
    
    # Eliminar
    await db.categories.delete_one({**tenant_filter, 'id': category_id})
    
    return {"success": True, "message": "Categoría eliminada exitosamente"}
