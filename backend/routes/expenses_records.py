"""
Rutas para el registro histórico de egresos
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from collections import defaultdict

from utils import db, get_current_user
from models.users import User

router = APIRouter(prefix="/expenses-records", tags=["expenses-records"])

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

@router.get("/calendar/{year}/{month}")
async def get_expenses_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener datos del calendario de egresos para un mes específico
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
        
        # Obtener todos los egresos del mes
        expenses = await db.expenses.find({
            'created_at': {
                '$gte': month_start_utc.isoformat(),
                '$lt': month_end_utc.isoformat()
            }
        }, {'_id': 0}).to_list(10000)
        
        # Agrupar por día (en hora Chile)
        daily_totals = defaultdict(float)
        for expense in expenses:
            created_at_str = expense.get('created_at')
            if created_at_str:
                created_at_utc = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                created_at_chile = created_at_utc.astimezone(CHILE_TZ)
                day = created_at_chile.day
                daily_totals[day] += expense.get('amount', 0)
        
        # Calcular total mensual
        monthly_total = sum(daily_totals.values())
        
        # Calcular total anual (todos los meses del año)
        year_start_chile = datetime(year, 1, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        year_end_chile = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=CHILE_TZ)
        
        year_start_utc = year_start_chile.astimezone(timezone.utc)
        year_end_utc = year_end_chile.astimezone(timezone.utc)
        
        yearly_expenses = await db.expenses.find({
            'created_at': {
                '$gte': year_start_utc.isoformat(),
                '$lt': year_end_utc.isoformat()
            }
        }, {'_id': 0, 'amount': 1}).to_list(100000)
        
        yearly_total = sum(exp.get('amount', 0) for exp in yearly_expenses)
        
        return {
            'year': year,
            'month': month,
            'daily_totals': dict(daily_totals),
            'monthly_total': monthly_total,
            'yearly_total': yearly_total
        }
        
    except Exception as e:
        print(f"Error en get_expenses_calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/day/{date}")
async def get_day_expenses(
    date: str,  # Formato: YYYY-MM-DD
    current_user: User = Depends(get_current_user)
):
    """
    Obtener todos los egresos de un día específico con timestamps
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
        
        # Obtener egresos del día
        expenses = await db.expenses.find({
            'created_at': {
                '$gte': day_start_utc.isoformat(),
                '$lt': day_end_utc.isoformat()
            }
        }, {'_id': 0}).to_list(1000)
        
        # Convertir timestamps a hora Chile para mostrar
        for expense in expenses:
            created_at_str = expense.get('created_at')
            if created_at_str:
                created_at_utc = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                created_at_chile = created_at_utc.astimezone(CHILE_TZ)
                expense['display_time'] = created_at_chile.strftime('%I:%M %p')
                expense['display_datetime'] = created_at_chile.strftime('%Y-%m-%d %H:%M:%S')
        
        # Ordenar por fecha descendente
        expenses.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        total = sum(exp.get('amount', 0) for exp in expenses)
        
        return {
            'date': date,
            'expenses': expenses,
            'total': total,
            'count': len(expenses)
        }
        
    except Exception as e:
        print(f"Error en get_day_expenses: {e}")
        raise HTTPException(status_code=500, detail=str(e))
