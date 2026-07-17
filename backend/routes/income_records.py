"""
Rutas para el registro histórico de otros ingresos
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from collections import defaultdict

from utils import db, get_current_user
from models.users import User
from middleware.tenant import get_tenant_filter, add_account_id_to_document

router = APIRouter(prefix="/income-records", tags=["income-records"])

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

@router.get("/calendar/{year}/{month}")
async def get_income_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener datos del calendario de otros ingresos para un mes específico
    Retorna: total diario, total mensual, total anual
    """
    try:
        # Validar fecha
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Mes inválido")
        
        # Calcular rango del mes en zona horaria de Chile
        month_start_chile = datetime(year, month, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        if month == 12:
            month_end_chile = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        else:
            month_end_chile = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        
        # Convertir a UTC para query
        month_start_utc = month_start_chile.astimezone(timezone.utc)
        month_end_utc = month_end_chile.astimezone(timezone.utc)
        
        # Obtener todos los ingresos del mes (con filtro de tenant)
        tenant_filter = get_tenant_filter(current_user.dict())
        tenant_filter['created_at'] = {
            '$gte': month_start_utc.isoformat(),
            '$lt': month_end_utc.isoformat()
        }
        
        incomes = await db.other_income.find(tenant_filter, {'_id': 0}).to_list(10000)
        
        # Agrupar por día (en hora Chile)
        daily_totals = defaultdict(float)
        for income in incomes:
            created_at_str = income.get('created_at')
            if created_at_str:
                created_at_utc = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                created_at_chile = created_at_utc.astimezone(CHILE_TZ)
                day = created_at_chile.day
                daily_totals[day] += income.get('amount', 0)
        
        # Calcular total mensual
        monthly_total = sum(daily_totals.values())
        
        # Calcular total anual
        year_start_chile = datetime(year, 1, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        year_end_chile = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        
        year_start_utc = year_start_chile.astimezone(timezone.utc)
        year_end_utc = year_end_chile.astimezone(timezone.utc)
        
        # Filtro de tenant para total anual
        tenant_filter_year = get_tenant_filter(current_user.dict())
        tenant_filter_year['created_at'] = {
            '$gte': year_start_utc.isoformat(),
            '$lt': year_end_utc.isoformat()
        }
        
        yearly_incomes = await db.other_income.find(
            tenant_filter_year,
            {'_id': 0, 'amount': 1}
        ).to_list(100000)
        
        yearly_total = sum(inc.get('amount', 0) for inc in yearly_incomes)
        
        return {
            'year': year,
            'month': month,
            'daily_totals': dict(daily_totals),
            'monthly_total': monthly_total,
            'yearly_total': yearly_total
        }
        
    except Exception as e:
        print(f"Error en get_income_calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/day/{date}")
async def get_day_income(
    date: str,  # Formato: YYYY-MM-DD
    current_user: User = Depends(get_current_user)
):
    """
    Obtener todos los otros ingresos de un día específico con timestamps
    """
    try:
        # Parsear fecha
        date_parts = date.split('-')
        year, month, day = int(date_parts[0]), int(date_parts[1]), int(date_parts[2])
        
        # Crear rango del día en zona horaria de Chile
        day_start_chile = datetime(year, month, day, 0, 0, 0, tzinfo=CHILE_TZ)
        day_end_chile = day_start_chile + timedelta(days=1)
        
        # Convertir a UTC
        day_start_utc = day_start_chile.astimezone(timezone.utc)
        day_end_utc = day_end_chile.astimezone(timezone.utc)
        
        # Obtener ingresos del día (con filtro de tenant)
        tenant_filter = get_tenant_filter(current_user.dict())
        tenant_filter['created_at'] = {
            '$gte': day_start_utc.isoformat(),
            '$lt': day_end_utc.isoformat()
        }
        
        incomes = await db.other_income.find(tenant_filter, {'_id': 0}).to_list(1000)
        
        # Convertir timestamps a hora Chile para mostrar
        for income in incomes:
            created_at_str = income.get('created_at')
            if created_at_str:
                created_at_utc = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                created_at_chile = created_at_utc.astimezone(CHILE_TZ)
                income['display_time'] = created_at_chile.strftime('%I:%M %p')
                income['display_datetime'] = created_at_chile.strftime('%Y-%m-%d %H:%M:%S')
        
        # Ordenar por fecha descendente
        incomes.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        total = sum(inc.get('amount', 0) for inc in incomes)
        
        return {
            'date': date,
            'incomes': incomes,
            'total': total,
            'count': len(incomes)
        }
        
    except Exception as e:
        print(f"Error en get_day_income: {e}")
        raise HTTPException(status_code=500, detail=str(e))
