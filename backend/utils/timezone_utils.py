"""
Timezone Utilities for Negocio Feliz

This module provides utilities for handling timezone-aware datetime operations.
All business dates (sales, expenses, income) should use the account's configured timezone.

Policy:
- Store all timestamps as UTC ISO strings in MongoDB
- Convert to local timezone for display and date grouping
- Use account's timezone setting for all business logic
"""
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Tuple
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


def now_utc() -> datetime:
    """
    Get current UTC datetime (timezone-aware).
    
    Returns:
        Current UTC datetime
    """
    return datetime.now(timezone.utc)


def now_local(tz_string: str = "America/Santiago") -> datetime:
    """
    Get current local datetime in account's timezone.
    
    Args:
        tz_string: Timezone string
        
    Returns:
        Current datetime in local timezone
    """
    tz = ZoneInfo(tz_string)
    return datetime.now(tz)


def to_utc_iso(dt: datetime) -> str:
    """
    Convert datetime to UTC ISO string for MongoDB storage.
    
    Args:
        dt: Datetime object (timezone-aware or naive)
        
    Returns:
        ISO format string in UTC (e.g., "2026-08-06T20:00:00.000Z")
    """
    if dt.tzinfo is None:
        # Assume UTC if naive
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Convert to UTC
    dt_utc = dt.astimezone(timezone.utc)
    
    # Return ISO format with Z suffix
    return dt_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def parse_datetime(dt_string: str, tz_string: str = "America/Santiago") -> Optional[datetime]:
    """
    Parse datetime string to timezone-aware datetime.
    
    Handles multiple formats:
    - ISO with Z: "2026-08-06T14:30:18.030Z"
    - ISO with offset: "2026-08-06T20:00:00-04:00"
    - ISO with +00:00: "2026-08-03T07:40:05.190923+00:00"
    
    Args:
        dt_string: Datetime string
        tz_string: Target timezone for naive datetimes
        
    Returns:
        Timezone-aware datetime or None
    """
    if not dt_string:
        return None
    
    try:
        # Try to parse with fromisoformat
        dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        
        # If naive, assume it's in the target timezone
        if dt.tzinfo is None:
            tz = ZoneInfo(tz_string)
            dt = dt.replace(tzinfo=tz)
        
        return dt
    except (ValueError, AttributeError):
        return None


def to_local_datetime(dt_string: str, tz_string: str = "America/Santiago") -> Optional[datetime]:
    """
    Convert UTC datetime string to local timezone datetime.
    
    Args:
        dt_string: UTC datetime string
        tz_string: Target timezone
        
    Returns:
        Datetime in local timezone or None
    """
    dt = parse_datetime(dt_string, tz_string)
    if not dt:
        return None
    
    tz = ZoneInfo(tz_string)
    return dt.astimezone(tz)


def to_local_date(dt_string: str, tz_string: str = "America/Santiago") -> Optional[str]:
    """
    Convert UTC datetime string to local date (YYYY-MM-DD).
    
    Args:
        dt_string: UTC datetime string
        tz_string: Target timezone
        
    Returns:
        Date string in format YYYY-MM-DD or None
    """
    dt_local = to_local_datetime(dt_string, tz_string)
    if not dt_local:
        return None
    
    return dt_local.strftime("%Y-%m-%d")


def get_day_boundaries_utc(date_str: str, tz_string: str = "America/Santiago") -> Tuple[str, str]:
    """
    Get UTC boundaries for a local date.
    
    For example, if date_str is "2026-08-06" and timezone is "America/Santiago" (UTC-4):
    - Local start: 2026-08-06 00:00:00-04:00
    - Local end: 2026-08-06 23:59:59-04:00
    - UTC start: 2026-08-06 04:00:00+00:00
    - UTC end: 2026-08-07 03:59:59+00:00
    
    Args:
        date_str: Date in format YYYY-MM-DD (local date)
        tz_string: Timezone string
        
    Returns:
        Tuple of (start_utc_iso, end_utc_iso)
    """
    tz = ZoneInfo(tz_string)
    
    # Parse local date
    local_date = datetime.strptime(date_str, "%Y-%m-%d")
    
    # Create start and end of day in local timezone
    start_local = local_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=tz)
    end_local = local_date.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=tz)
    
    # Convert to UTC
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    
    return (
        to_utc_iso(start_utc),
        to_utc_iso(end_utc)
    )


def get_month_boundaries_utc(year: int, month: int, tz_string: str = "America/Santiago") -> Tuple[str, str]:
    """
    Get UTC boundaries for a local month.
    
    Args:
        year: Year (e.g., 2026)
        month: Month (1-12)
        tz_string: Timezone string
        
    Returns:
        Tuple of (start_utc_iso, end_utc_iso)
    """
    tz = ZoneInfo(tz_string)
    
    # First day of month
    first_day = datetime(year, month, 1, 0, 0, 0, tzinfo=tz)
    
    # Last day of month
    if month == 12:
        last_day = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=tz) - timedelta(microseconds=1)
    else:
        last_day = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=tz) - timedelta(microseconds=1)
    
    # Convert to UTC
    start_utc = first_day.astimezone(timezone.utc)
    end_utc = last_day.astimezone(timezone.utc)
    
    return (
        to_utc_iso(start_utc),
        to_utc_iso(end_utc)
    )


def format_datetime_local(dt_string: str, tz_string: str = "America/Santiago", format: str = "%d/%m/%Y %H:%M") -> str:
    """
    Format datetime string to local timezone string.
    
    Args:
        dt_string: UTC datetime string
        tz_string: Target timezone
        format: strftime format string
        
    Returns:
        Formatted datetime string in local timezone
    """
    dt_local = to_local_datetime(dt_string, tz_string)
    if not dt_local:
        return ""
    
    return dt_local.strftime(format)
