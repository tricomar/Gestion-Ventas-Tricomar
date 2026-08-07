"""
Routes for application settings (timezone, currency, etc.)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from models.users import User
from models.app_settings import (
    AppSettings, 
    AppSettingsUpdate, 
    CURRENCY_CONFIGS, 
    AVAILABLE_TIMEZONES
)
from utils.auth import get_current_user
from utils.database import db

router = APIRouter(prefix="/app-settings", tags=["app-settings"])


@router.get("/timezones")
async def get_available_timezones():
    """Get list of available timezones"""
    return {
        'timezones': AVAILABLE_TIMEZONES
    }


@router.get("/currencies")
async def get_available_currencies():
    """Get list of available currencies with their configurations"""
    currencies = []
    for code, config in CURRENCY_CONFIGS.items():
        currencies.append({
            'code': code,
            'name': config['name'],
            'symbol': config['symbol'],
            'decimal_places': config['decimal_places']
        })
    return {
        'currencies': currencies
    }


@router.get("")
async def get_app_settings(current_user: User = Depends(get_current_user)):
    """Get current application settings for the user's account"""
    settings = await db.app_settings.find_one(
        {'account_id': current_user.account_id},
        {'_id': 0}
    )
    
    if not settings:
        # Create default settings
        default_settings = AppSettings(
            account_id=current_user.account_id,
            timezone='America/Santiago',
            currency_code='CLP',
            currency_symbol='$',
            decimal_places=0,
            date_format='DD/MM/YYYY',
            time_format='24h'
        )
        
        await db.app_settings.insert_one(default_settings.model_dump())
        return default_settings
    
    return AppSettings(**settings)


@router.put("")
async def update_app_settings(
    settings_update: AppSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update application settings"""
    try:
        # Get current settings
        current_settings = await db.app_settings.find_one(
            {'account_id': current_user.account_id},
            {'_id': 0}
        )
        
        if not current_settings:
            # Create with updates
            new_settings = AppSettings(
                account_id=current_user.account_id,
                **settings_update.model_dump(exclude_none=True)
            )
            await db.app_settings.insert_one(new_settings.model_dump())
            return new_settings
        
        # Update only provided fields
        update_data = settings_update.model_dump(exclude_none=True)
        
        # If currency is updated, also update symbol and decimal_places
        if 'currency_code' in update_data:
            currency_code = update_data['currency_code']
            if currency_code in CURRENCY_CONFIGS:
                update_data['currency_symbol'] = CURRENCY_CONFIGS[currency_code]['symbol']
                update_data['decimal_places'] = CURRENCY_CONFIGS[currency_code]['decimal_places']
        
        await db.app_settings.update_one(
            {'account_id': current_user.account_id},
            {'$set': update_data}
        )
        
        # Return updated settings
        updated = await db.app_settings.find_one(
            {'account_id': current_user.account_id},
            {'_id': 0}
        )
        
        return AppSettings(**updated)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating settings: {str(e)}"
        )
