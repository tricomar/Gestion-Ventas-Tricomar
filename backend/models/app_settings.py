"""
Application Settings Model
"""
from pydantic import BaseModel
from typing import Optional


class AppSettings(BaseModel):
    """
    Global application settings for timezone and currency
    """
    account_id: str
    timezone: str = 'America/Santiago'  # Default to Chile
    currency_code: str = 'CLP'  # Default to Chilean Peso
    currency_symbol: str = '$'
    decimal_places: int = 0  # CLP doesn't use decimals
    date_format: str = 'DD/MM/YYYY'
    time_format: str = '24h'
    
    class Config:
        json_schema_extra = {
            "example": {
                "account_id": "acc_123",
                "timezone": "America/Santiago",
                "currency_code": "CLP",
                "currency_symbol": "$",
                "decimal_places": 0,
                "date_format": "DD/MM/YYYY",
                "time_format": "24h"
            }
        }


class AppSettingsUpdate(BaseModel):
    """
    Update application settings
    """
    timezone: Optional[str] = None
    currency_code: Optional[str] = None
    currency_symbol: Optional[str] = None
    decimal_places: Optional[int] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None


# Currency configurations
CURRENCY_CONFIGS = {
    'CLP': {
        'symbol': '$',
        'name': 'Peso Chileno',
        'decimal_places': 0,
        'format': '{symbol}{amount:,.0f}'
    },
    'USD': {
        'symbol': '$',
        'name': 'Dólar Estadounidense',
        'decimal_places': 2,
        'format': '{symbol}{amount:,.2f}'
    },
    'EUR': {
        'symbol': '€',
        'name': 'Euro',
        'decimal_places': 2,
        'format': '{symbol}{amount:,.2f}'
    },
    'ARS': {
        'symbol': '$',
        'name': 'Peso Argentino',
        'decimal_places': 2,
        'format': '{symbol}{amount:,.2f}'
    },
    'BRL': {
        'symbol': 'R$',
        'name': 'Real Brasileño',
        'decimal_places': 2,
        'format': '{symbol}{amount:,.2f}'
    },
    'MXN': {
        'symbol': '$',
        'name': 'Peso Mexicano',
        'decimal_places': 2,
        'format': '{symbol}{amount:,.2f}'
    }
}

# Common timezones for Latin America and worldwide
AVAILABLE_TIMEZONES = [
    {'value': 'America/Santiago', 'label': 'Chile (Santiago) - UTC-4/-3'},
    {'value': 'America/Argentina/Buenos_Aires', 'label': 'Argentina (Buenos Aires) - UTC-3'},
    {'value': 'America/Sao_Paulo', 'label': 'Brasil (São Paulo) - UTC-3'},
    {'value': 'America/Mexico_City', 'label': 'México (Ciudad de México) - UTC-6/-5'},
    {'value': 'America/Lima', 'label': 'Perú (Lima) - UTC-5'},
    {'value': 'America/Bogota', 'label': 'Colombia (Bogotá) - UTC-5'},
    {'value': 'America/Caracas', 'label': 'Venezuela (Caracas) - UTC-4'},
    {'value': 'America/Montevideo', 'label': 'Uruguay (Montevideo) - UTC-3'},
    {'value': 'America/La_Paz', 'label': 'Bolivia (La Paz) - UTC-4'},
    {'value': 'America/Asuncion', 'label': 'Paraguay (Asunción) - UTC-4/-3'},
    {'value': 'America/Guayaquil', 'label': 'Ecuador (Guayaquil) - UTC-5'},
    {'value': 'America/Panama', 'label': 'Panamá - UTC-5'},
    {'value': 'America/Costa_Rica', 'label': 'Costa Rica - UTC-6'},
    {'value': 'America/New_York', 'label': 'EE.UU. (Nueva York) - UTC-5/-4'},
    {'value': 'America/Los_Angeles', 'label': 'EE.UU. (Los Ángeles) - UTC-8/-7'},
    {'value': 'Europe/Madrid', 'label': 'España (Madrid) - UTC+1/+2'},
    {'value': 'Europe/London', 'label': 'Reino Unido (Londres) - UTC+0/+1'},
    {'value': 'UTC', 'label': 'UTC (Universal)'}
]
