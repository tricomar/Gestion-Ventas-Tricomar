"""
Helper functions for timezone and currency handling
"""
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from utils.database import db


async def get_account_timezone(account_id: str) -> str:
    """Get configured timezone for account, default to Chile"""
    settings = await db.app_settings.find_one(
        {'account_id': account_id},
        {'_id': 0, 'timezone': 1}
    )
    
    if settings and settings.get('timezone'):
        return settings['timezone']
    
    return 'America/Santiago'  # Default


async def get_account_currency(account_id: str) -> dict:
    """Get configured currency for account"""
    settings = await db.app_settings.find_one(
        {'account_id': account_id},
        {'_id': 0, 'currency_code': 1, 'currency_symbol': 1, 'decimal_places': 1}
    )
    
    if settings:
        return {
            'code': settings.get('currency_code', 'CLP'),
            'symbol': settings.get('currency_symbol', '$'),
            'decimal_places': settings.get('decimal_places', 0)
        }
    
    return {'code': 'CLP', 'symbol': '$', 'decimal_places': 0}


def get_timezone_now(timezone_str: str) -> datetime:
    """Get current datetime in specified timezone"""
    tz = ZoneInfo(timezone_str)
    return datetime.now(tz)


def format_currency(amount: float, currency_config: dict) -> str:
    """Format amount according to currency configuration"""
    symbol = currency_config.get('symbol', '$')
    decimal_places = currency_config.get('decimal_places', 0)
    
    if decimal_places == 0:
        return f"{symbol}{amount:,.0f}"
    else:
        return f"{symbol}{amount:,.{decimal_places}f}"
