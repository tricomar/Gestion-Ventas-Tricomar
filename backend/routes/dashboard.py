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
            store_info=[],
            today_sales=0
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
    
    def calculate_metrics(sales, store_code, store_index=None):
        # Filtrar ventas por código de tienda
        # Manejar códigos legacy (A, B, C) y códigos personalizados (PT, ST, TT)
        filtered_sales = []
        for s in sales:
            sale_store = s.get('store')
            # Coincidencia directa por código
            if sale_store == store_code:
                filtered_sales.append(s)
            # Fallback: mapear códigos legacy A, B, C a índices 0, 1, 2
            elif store_index is not None and sale_store in ['A', 'B', 'C', 'D', 'E']:
                legacy_index = ord(sale_store) - ord('A')
                if legacy_index == store_index:
                    filtered_sales.append(s)
        
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
        
        stores_day[store_id] = calculate_metrics(today_sales, store_code, index)
        stores_month[store_id] = calculate_metrics(month_sales, store_code, index)
        
        store_info.append({
            'id': store_id,
            'name': store.get('name'),
            'code': store_code,
            'color': colors[index % len(colors)]
        })
    
    # Calcular total de ventas del día
    today_sales_total = sum(sale.get('total', 0) for sale in today_sales)
    
    return RealtimeMetrics(
        stores_day=stores_day,
        stores_month=stores_month,
        general_day=calculate_general_metrics(today_income, today_expenses),
        general_month=calculate_general_metrics(month_income, month_expenses),
        store_info=store_info,
        today_sales=today_sales_total
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
    
    def calculate_metrics(sales, store_code, store_index=None):
        # Filtrar ventas por código de tienda
        # Manejar códigos legacy (A, B, C) y códigos personalizados (PT, ST, TT)
        filtered_sales = []
        for s in sales:
            sale_store = s.get('store')
            # Coincidencia directa por código
            if sale_store == store_code:
                filtered_sales.append(s)
            # Fallback: mapear códigos legacy A, B, C a índices 0, 1, 2
            elif store_index is not None and sale_store in ['A', 'B', 'C', 'D', 'E']:
                legacy_index = ord(sale_store) - ord('A')
                if legacy_index == store_index:
                    filtered_sales.append(s)
        
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
        
        stores_data[store_id] = calculate_metrics(month_sales, store_code, index)
        
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

@router.get("/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    """
    Get comprehensive dashboard statistics including sales, products, transactions, etc.
    Uses both POS sales_records and ecommerce_orders data
    """
    try:
        # Date ranges
        now_chile = datetime.now(CHILE_TZ)
        today_start = now_chile.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        tomorrow_start = today_start + timedelta(days=1)
        month_start = now_chile.replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        
        if month_start.month == 12:
            next_month_start = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month_start = month_start.replace(month=month_start.month + 1)
        
        # Get sales_records (POS sales)
        today_sales = await db.sales_records.find({
            'account_id': current_user.account_id,
            'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
        }, {'_id': 0}).to_list(10000)
        
        month_sales = await db.sales_records.find({
            'account_id': current_user.account_id,
            'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
        }, {'_id': 0}).to_list(100000)
        
        # Get ecommerce orders to supplement data
        today_ecommerce = await db.ecommerce_orders.find({
            'account_id': current_user.account_id,
            'date_add': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
        }, {'_id': 0}).to_list(10000)
        
        month_ecommerce = await db.ecommerce_orders.find({
            'account_id': current_user.account_id,
            'date_add': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
        }, {'_id': 0}).to_list(100000)
        
        # Calculate totals from POS
        today_sales_total = sum(s.get('total', 0) for s in today_sales)
        month_sales_total = sum(s.get('total', 0) for s in month_sales)
        
        # Add ecommerce sales
        today_ecommerce_total = sum(float(o.get('total_paid', 0)) for o in today_ecommerce)
        month_ecommerce_total = sum(float(o.get('total_paid', 0)) for o in month_ecommerce)
        
        total_today = today_sales_total + today_ecommerce_total
        total_month = month_sales_total + month_ecommerce_total
        
        # Get expenses
        today_expenses = await db.expenses_records.find({
            'account_id': current_user.account_id,
            'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
        }, {'_id': 0}).to_list(10000)
        
        today_expenses_total = sum(e.get('amount', 0) for e in today_expenses)
        
        # Get products count
        products_count = await db.products.count_documents({'account_id': current_user.account_id})
        
        # Sales by payment method (from POS)
        payment_methods = {}
        for sale in month_sales:
            method = sale.get('payment_method', 'Efectivo')
            if method not in payment_methods:
                payment_methods[method] = 0
            payment_methods[method] += sale.get('total', 0)
        
        # Add ecommerce payment methods
        for order in month_ecommerce:
            method = order.get('payment_method', 'PrestaShop')
            if method not in payment_methods:
                payment_methods[method] = 0
            payment_methods[method] += float(order.get('total_paid', 0))
        
        # Recent sales (last 10 from both POS and ecommerce)
        recent_pos_sales = await db.sales_records.find({
            'account_id': current_user.account_id
        }, {'_id': 0}).sort('created_at', -1).limit(5).to_list(5)
        
        recent_ecommerce = await db.ecommerce_orders.find({
            'account_id': current_user.account_id
        }, {'_id': 0}).sort('date_add', -1).limit(5).to_list(5)
        
        # Format recent sales
        recent_sales = []
        for sale in recent_pos_sales:
            recent_sales.append({
                'date': sale.get('created_at'),
                'product': sale.get('product_name', 'Venta POS'),
                'total': sale.get('total', 0),
                'type': 'POS'
            })
        
        for order in recent_ecommerce:
            recent_sales.append({
                'date': order.get('date_add'),
                'product': f"Orden #{order.get('reference', order.get('id', 'N/A'))}",
                'total': float(order.get('total_paid', 0)),
                'type': 'Ecommerce'
            })
        
        # Sort by date
        recent_sales.sort(key=lambda x: x.get('date', ''), reverse=True)
        recent_sales = recent_sales[:10]
        
        # Sales by store
        sales_by_store = {}
        for sale in month_sales:
            store = sale.get('store', 'A')
            if store not in sales_by_store:
                sales_by_store[store] = []
            sales_by_store[store].append(sale)
        
        # Daily sales for last 30 days
        thirty_days_ago = now_chile - timedelta(days=30)
        thirty_days_sales = await db.sales_records.find({
            'account_id': current_user.account_id,
            'created_at': {'$gte': thirty_days_ago.astimezone(timezone.utc).isoformat()}
        }, {'_id': 0}).to_list(100000)
        
        thirty_days_ecommerce = await db.ecommerce_orders.find({
            'account_id': current_user.account_id,
            'date_add': {'$gte': thirty_days_ago.astimezone(timezone.utc).isoformat()}
        }, {'_id': 0}).to_list(100000)
        
        daily_sales_map = {}
        
        # Add POS sales
        for sale in thirty_days_sales:
            try:
                date_str = sale.get('created_at', '')[:10]
                if date_str not in daily_sales_map:
                    daily_sales_map[date_str] = 0
                daily_sales_map[date_str] += sale.get('total', 0)
            except (KeyError, ValueError, TypeError):
                continue
        
        # Add ecommerce sales
        for order in thirty_days_ecommerce:
            try:
                date_str = order.get('date_add', '')[:10]
                if date_str not in daily_sales_map:
                    daily_sales_map[date_str] = 0
                daily_sales_map[date_str] += float(order.get('total_paid', 0))
            except (KeyError, ValueError, TypeError):
                continue
        
        daily_sales_chart = [
            {'date': date, 'total': total}
            for date, total in sorted(daily_sales_map.items())[-30:]
        ]
        
        return {
            'today_sales': total_today,
            'today_transactions': len(today_sales) + len(today_ecommerce),
            'today_expenses': today_expenses_total,
            'monthly_sales': total_month,
            'monthly_transactions': len(month_sales) + len(month_ecommerce),
            'total_products': products_count,
            'sales_by_payment_method': payment_methods,
            'recent_sales': recent_sales,
            'sales_by_store': {k: len(v) for k, v in sales_by_store.items()},
            'daily_sales_chart': daily_sales_chart,
            'ecommerce_orders_count': len(month_ecommerce)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching dashboard stats: {str(e)}"
        )

@router.get("/historic-daily-data")
async def get_historic_daily_data(
    year: int, 
    month: int, 
    current_user: User = Depends(get_current_user)
):
    """Get daily metrics for a specific historic month for chart visualization"""
    from calendar import monthrange
    
    # Obtener las tiendas de la cuenta del usuario
    account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
    
    if not account or not account.get("stores"):
        return []
    
    stores = account.get("stores", [])
    
    # Calculate date range for the specified month
    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_month_start = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Get all sales for that month
    month_sales = await db.sales.find({
        'account_id': current_user.account_id,
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
        
        # Build day entry with dynamic stores
        day_entry = {'day': day}
        
        # Calculate metrics for each store dynamically
        for index, store in enumerate(stores):
            store_code = store.get('code')
            store_id = store.get('id')
            
            # Filtrar ventas con lógica legacy-compatible
            store_sales = []
            for s in day_sales:
                sale_store = s.get('store')
                # Coincidencia directa por código
                if sale_store == store_code:
                    store_sales.append(s)
                # Fallback: mapear códigos legacy A, B, C a índices 0, 1, 2
                elif sale_store in ['A', 'B', 'C', 'D', 'E']:
                    legacy_index = ord(sale_store) - ord('A')
                    if legacy_index == index:
                        store_sales.append(s)
            
            compras = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in store_sales)
            
            utilidades = 0
            iva_a_favor = 0
            for s in store_sales:
                costo_total = s.get('cost_price', 0) * s.get('quantity', 0)
                total = s.get('total', 0)
                
                if s.get('has_tax', True):
                    precio_sin_iva = total / 1.19
                else:
                    precio_sin_iva = total
                    iva_a_favor += total / 1.19 * 0.19
                
                ganancia_venta = precio_sin_iva - costo_total
                utilidades += ganancia_venta
            
            # Add store metrics to day entry using store_id as key
            day_entry[store_id] = {
                'compras': compras,
                'utilidades': utilidades,
                'iva_a_favor': iva_a_favor
            }
        
        daily_data.append(day_entry)
    
    return daily_data

@router.get("/sales-by-store")
async def get_sales_by_store(
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener ventas por tienda para gráfico de líneas
    Retorna datos agregados por día y tienda para los últimos N días
    """
    try:
        # Obtener tiendas de la cuenta
        account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
        
        if not account or not account.get("stores"):
            return []
        
        stores = account.get("stores", [])
        
        # Calcular rango de fechas
        now_chile = datetime.now(CHILE_TZ)
        start_date = (now_chile - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Obtener ventas en el rango de fechas
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        sales_cursor = db.sales.find({
            **tenant_filter,
            "created_at": {"$gte": start_date.isoformat()}
        }, {"_id": 0})
        
        sales = await sales_cursor.to_list(10000)
        
        # Agrupar ventas por fecha y tienda
        sales_by_date = defaultdict(lambda: defaultdict(float))
        
        for sale in sales:
            # Extraer fecha (solo YYYY-MM-DD)
            sale_date = sale.get("date", sale.get("created_at", "")[:10])
            
            # Determinar tienda
            if "store" in sale:
                store_code = sale["store"]
            elif "product_store" in sale:
                store_code = sale["product_store"]
            else:
                # Si no hay tienda, intentar extraer del producto
                store_code = "general"
            
            # Sumar total
            total = sale.get("total", 0)
            sales_by_date[sale_date][store_code] += total
        
        # Formatear datos para el gráfico
        chart_data = []
        current_date = start_date
        
        for i in range(days):
            date_str = current_date.strftime('%Y-%m-%d')
            date_label = current_date.strftime('%d/%m')
            
            row = {"date": date_label}
            
            # Agregar ventas de cada tienda
            for store in stores:
                store_code = store.get("code", store.get("id", ""))
                row[store_code] = round(sales_by_date[date_str].get(store_code, 0), 0)
            
            chart_data.append(row)
            current_date += timedelta(days=1)
        
        return chart_data
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener ventas por tienda: {str(e)}"
        )
