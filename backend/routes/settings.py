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
