"""
Router para métricas y estadísticas del dashboard
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from collections import defaultdict
import httpx
import asyncio

from models.dashboard import RealtimeMetrics, DashboardStats
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from models.users import User
from utils import db, get_current_user

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Cache para indicadores económicos
indicators_cache = {
    'data': None,
    'timestamp': None
}
CACHE_DURATION = timedelta(hours=1)

@router.get("/realtime-metrics", response_model=RealtimeMetrics)
async def get_realtime_metrics(current_user: User = Depends(get_current_user)):
    # Obtener las tiendas de la cuenta del usuario
    account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
    
    if not account or not account.get("stores"):
        # Si no hay tiendas, retornar métricas vacías
        return RealtimeMetrics(
            stores_day={},
            stores_month={},
            general_day={"otros_ingresos": 0, "egresos": 0},
            general_month={"otros_ingresos": 0, "egresos": 0},
            store_info=[]
        )
    
    stores = account.get("stores", [])
    
    # Usar hora de Chile para determinar el día actual
    now_chile = datetime.now(CHILE_TZ)
    today_start_chile = now_chile.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start_chile = today_start_chile + timedelta(days=1)
    
    # Inicio del mes en Chile
    month_start_chile = now_chile.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Próximo mes
    if month_start_chile.month == 12:
        next_month_start_chile = month_start_chile.replace(year=month_start_chile.year + 1, month=1)
    else:
        next_month_start_chile = month_start_chile.replace(month=month_start_chile.month + 1)
    
    # Convertir a UTC para las queries
    today_start = today_start_chile.astimezone(timezone.utc)
    tomorrow_start = tomorrow_start_chile.astimezone(timezone.utc)
    month_start = month_start_chile.astimezone(timezone.utc)
    next_month_start = next_month_start_chile.astimezone(timezone.utc)
    
    # Get all sales
    today_sales = await db.sales.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
    }, {'_id': 0}).to_list(10000)
    
    month_sales = await db.sales.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    # Get other income
    today_income = await db.other_income.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
    }, {'_id': 0}).to_list(10000)
    
    month_income = await db.other_income.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    # Get expenses
    today_expenses = await db.expenses.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
    }, {'_id': 0}).to_list(10000)
    
    month_expenses = await db.expenses.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    def calculate_metrics(sales, store_code):
        filtered_sales = [s for s in sales if s.get('store') == store_code]
        
        # Compras: sum of cost prices
        compras = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in filtered_sales)
        
        # IVA a favor: Para ventas SIN IVA marcado (has_tax=False)
        iva_a_favor = sum(
            s.get('total', 0) / 1.19 * 0.19
            for s in filtered_sales if not s.get('has_tax', True)
        )
        
        # Ganancia = Precio de Venta (sin IVA) - Precio de Compra
        utilidades = 0
        for s in filtered_sales:
            total = s.get('total', 0)
            costo_total = s.get('cost_price', 0) * s.get('quantity', 0)
            
            if s.get('has_tax', True):
                precio_sin_iva = total / 1.19
            else:
                precio_sin_iva = total
            
            ganancia_venta = precio_sin_iva - costo_total
            utilidades += ganancia_venta
        
        return {
            'compras': compras,
            'iva_a_favor': iva_a_favor,
            'utilidades': utilidades
        }
    
    def calculate_general_metrics(income_list, expenses_list):
        otros_ingresos = sum(inc.get('amount', 0) for inc in income_list)
        egresos = sum(exp.get('amount', 0) for exp in expenses_list)
        
        return {
            'otros_ingresos': otros_ingresos,
            'egresos': egresos
        }
    
    # Calcular métricas para todas las tiendas dinámicamente
    stores_day = {}
    stores_month = {}
    store_info = []
    colors = ['#D4F0A5', '#FADBB0', '#FFE4E6', '#E0E7FF', '#FEF3C7']
    
    for index, store in enumerate(stores):
        store_code = store.get('code')
        store_id = store.get('id')
        
        stores_day[store_id] = calculate_metrics(today_sales, store_code)
        stores_month[store_id] = calculate_metrics(month_sales, store_code)
        
        store_info.append({
            'id': store_id,
            'name': store.get('name'),
            'code': store_code,
            'color': colors[index % len(colors)]
        })
    
    return RealtimeMetrics(
        stores_day=stores_day,
        stores_month=stores_month,
        general_day=calculate_general_metrics(today_income, today_expenses),
        general_month=calculate_general_metrics(month_income, month_expenses),
        store_info=store_info
    )

@router.get("/historic-months")
async def get_historic_months(current_user: User = Depends(get_current_user)):
    """Get list of months with data from last 2 years"""
    now = datetime.now(timezone.utc)
    two_years_ago = now - timedelta(days=730)
    
    # Get all sales from last 2 years
    sales = await db.sales.find({
        'created_at': {'$gte': two_years_ago.isoformat()}
    }, {'_id': 0, 'created_at': 1}).to_list(100000)
    
    # Extract unique year-month combinations
    months_set = set()
    for sale in sales:
        try:
            if isinstance(sale.get('created_at'), str):
                dt = datetime.fromisoformat(sale['created_at'])
            else:
                dt = sale['created_at']
            months_set.add((dt.year, dt.month))
        except (ValueError, KeyError, TypeError):
            continue
    
    # Convert to list and sort (most recent first)
    months_list = [{'year': y, 'month': m} for y, m in sorted(months_set, reverse=True)]
    
    return months_list

@router.get("/historic-data")
async def get_historic_data(
    year: int, 
    month: int, 
    current_user: User = Depends(get_current_user)
):
    """Get metrics for a specific historic month"""
    # Obtener las tiendas de la cuenta del usuario
    account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
    
    if not account or not account.get("stores"):
        return {
            "stores": {},
            "general": {"otros_ingresos": 0, "egresos": 0},
            "store_info": []
        }
    
    stores = account.get("stores", [])
    
    # Calculate date range for the specified month
    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_month_start = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Get data for that month
    month_sales = await db.sales.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    month_income = await db.other_income.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    month_expenses = await db.expenses.find({
        'account_id': current_user.account_id,
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    def calculate_metrics(sales, store_code):
        filtered_sales = [s for s in sales if s.get('store') == store_code]
        
        compras = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in filtered_sales)
        
        iva_a_favor = sum(
            s.get('total', 0) / 1.19 * 0.19
            for s in filtered_sales if not s.get('has_tax', True)
        )
        
        utilidades = 0
        for s in filtered_sales:
            total = s.get('total', 0)
            costo_total = s.get('cost_price', 0) * s.get('quantity', 0)
            
            if s.get('has_tax', True):
                precio_sin_iva = total / 1.19
            else:
                precio_sin_iva = total
            
            ganancia_venta = precio_sin_iva - costo_total
            utilidades += ganancia_venta
        
        return {
            'compras': compras,
            'iva_a_favor': iva_a_favor,
            'utilidades': utilidades
        }
    
    def calculate_general_metrics(income_list, expenses_list):
        otros_ingresos = sum(inc.get('amount', 0) for inc in income_list)
        egresos = sum(exp.get('amount', 0) for exp in expenses_list)
        
        return {
            'otros_ingresos': otros_ingresos,
            'egresos': egresos
        }
    
    # Calcular métricas para todas las tiendas
    stores_data = {}
    store_info = []
    colors = ['#D4F0A5', '#FADBB0', '#FFE4E6', '#E0E7FF', '#FEF3C7']
    
    for index, store in enumerate(stores):
        store_code = store.get('code')
        store_id = store.get('id')
        
        stores_data[store_id] = calculate_metrics(month_sales, store_code)
        
        store_info.append({
            'id': store_id,
            'name': store.get('name'),
            'code': store_code,
            'color': colors[index % len(colors)]
        })
    
    return {
        "stores": stores_data,
        "general": calculate_general_metrics(month_income, month_expenses),
        "store_info": store_info
    }

@router.get("/historic-daily-data")
async def get_historic_daily_data(
    year: int, 
    month: int, 
    current_user: User = Depends(get_current_user)
):
    """Get daily metrics for a specific historic month for chart visualization"""
    from calendar import monthrange
    
    # Calculate date range for the specified month
    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_month_start = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Get all sales for that month
    month_sales = await db.sales.find({
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    
    # Get number of days in month
    days_in_month = monthrange(year, month)[1]
    
    # Initialize daily data
    daily_data = []
    
    for day in range(1, days_in_month + 1):
        day_start = datetime(year, month, day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        
        # Filter sales for this specific day
        day_sales = [
            s for s in month_sales 
            if day_start.isoformat() <= s.get('created_at', '') < day_end.isoformat()
        ]
        
        # Calculate metrics for Store A
        store_a_sales = [s for s in day_sales if s.get('store') == 'A']
        compras_a = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in store_a_sales)
        
        utilidades_a = 0
        iva_a_favor_a = 0
        for s in store_a_sales:
            costo_total = s.get('cost_price', 0) * s.get('quantity', 0)
            total = s.get('total', 0)
