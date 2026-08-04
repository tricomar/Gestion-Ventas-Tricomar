"""
Router para gestión de configuración global
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from models.settings import Settings, SettingsUpdate
from models.users import User
from utils import db, get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("", response_model=Settings)
async def get_settings(current_user: User = Depends(get_current_user)):
    """Get application settings"""
    settings_doc = await db.settings.find_one({'id': 'settings'}, {'_id': 0})
    
    if not settings_doc:
        # Create default settings if not exists
        default_settings = Settings()
        doc = default_settings.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.settings.insert_one(doc)
        return default_settings
    
    # Convert datetime strings to datetime objects
    if isinstance(settings_doc.get('created_at'), str):
        settings_doc['created_at'] = datetime.fromisoformat(settings_doc['created_at'])
    if isinstance(settings_doc.get('updated_at'), str):
        settings_doc['updated_at'] = datetime.fromisoformat(settings_doc['updated_at'])
    
    return Settings(**settings_doc)

@router.put("", response_model=Settings)
async def update_settings(settings_input: SettingsUpdate, current_user: User = Depends(get_current_user)):
    """Update application settings"""
    
    # Check if settings exist
    existing = await db.settings.find_one({'id': 'settings'}, {'_id': 0})
    
    update_data = settings_input.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        # Update existing settings
        await db.settings.update_one(
            {'id': 'settings'},
            {'$set': update_data}
        )
    else:
        # Create new settings
        settings = Settings(**settings_input.model_dump())
        doc = settings.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.settings.insert_one(doc)
    
    # Fetch and return updated settings
    updated_doc = await db.settings.find_one({'id': 'settings'}, {'_id': 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    if isinstance(updated_doc.get('updated_at'), str):
        updated_doc['updated_at'] = datetime.fromisoformat(updated_doc['updated_at'])
    
    return Settings(**updated_doc)

@router.patch("/personalization")
async def update_personalization(
    update_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update personalization settings (logo and company name)"""
    try:
        # Validar campos permitidos
        allowed_fields = ['company_logo', 'company_name']
        filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        if not filtered_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        filtered_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # Actualizar en settings globales
        result = await db.settings.update_one(
            {'id': 'settings'},
            {'$set': filtered_data},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Personalización actualizada exitosamente",
            "updated_fields": list(filtered_data.keys())
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar personalización: {str(e)}"
        )
