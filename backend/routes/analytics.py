"""
Rutas para Analítica y Dashboard
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from utils.auth import get_current_user, User
from utils.database import db
from middleware.tenant import get_tenant_filter
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
from collections import defaultdict
import calendar

router = APIRouter()

def get_date_range(period: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Calcula el rango de fechas según el periodo seleccionado"""
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        # Periodo anterior: ayer
        prev_start = start - timedelta(days=1)
        prev_end = start
    elif period == "week":
        # Esta semana (lunes a hoy)
        start = now - timedelta(days=now.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        # Semana pasada
        prev_start = start - timedelta(days=7)
        prev_end = start
    elif period == "month":
        # Este mes (día 1 a hoy)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
        # Mes pasado
        if start.month == 1:
            prev_start = start.replace(year=start.year - 1, month=12, day=1)
        else:
            prev_start = start.replace(month=start.month - 1, day=1)
        prev_end = start
    elif period == "year":
        # Este año (enero 1 a hoy)
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
        # Año pasado
        prev_start = start.replace(year=start.year - 1)
        prev_end = start
    elif period == "custom" and start_date and end_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        # Periodo anterior del mismo tamaño
        delta = end - start
        prev_start = start - delta
        prev_end = start
    else:
        # Default: mes actual
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
        if start.month == 1:
            prev_start = start.replace(year=start.year - 1, month=12, day=1)
        else:
            prev_start = start.replace(month=start.month - 1, day=1)
        prev_end = start
    
    return {
        "start": start,
        "end": end,
        "prev_start": prev_start,
        "prev_end": prev_end
    }


@router.get("/summary")
async def get_analytics_summary(
    period: str = Query("month", regex="^(today|week|month|year|custom)$"),
    store_id: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    KPIs principales para el dashboard
    - Ventas totales (con variación %)
    - N° de ventas
    - Ticket promedio
    - Producto más vendido
    - Tienda top
    - Ventas netas (ventas - egresos)
    """
    try:
        dates = get_date_range(period, start_date, end_date)
        
        # Filtro base de tenant
        tenant_filter = get_tenant_filter(current_user.dict())
        
        # Filtro de tienda si se especifica
        if store_id and store_id != "all":
            tenant_filter["store"] = store_id
        
        # Filtro de fecha actual
        current_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": dates["start"].isoformat(),
                "$lte": dates["end"].isoformat()
            }
        }
        
        # Filtro de fecha anterior
        prev_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": dates["prev_start"].isoformat(),
                "$lte": dates["prev_end"].isoformat()
            }
        }
        
        # Obtener ventas actuales y anteriores
        current_sales = await db.sales.find(current_filter, {"_id": 0}).to_list(100000)
        prev_sales = await db.sales.find(prev_filter, {"_id": 0}).to_list(100000)
        
        # Calcular métricas actuales
        total_sales = sum(sale.get("total", 0) for sale in current_sales)
        num_sales = len(current_sales)
        avg_ticket = total_sales / num_sales if num_sales > 0 else 0
        
        # Calcular métricas anteriores
        prev_total_sales = sum(sale.get("total", 0) for sale in prev_sales)
        prev_num_sales = len(prev_sales)
        
        # Variaciones %
        sales_variation = ((total_sales - prev_total_sales) / prev_total_sales * 100) if prev_total_sales > 0 else 0
        num_sales_variation = ((num_sales - prev_num_sales) / prev_num_sales * 100) if prev_num_sales > 0 else 0
        
        # Producto más vendido
        product_counts = defaultdict(lambda: {"name": "", "quantity": 0, "total": 0})
        for sale in current_sales:
            product_name = sale.get("product_name", "Desconocido")
            product_counts[product_name]["name"] = product_name
            product_counts[product_name]["quantity"] += sale.get("quantity", 0)
            product_counts[product_name]["total"] += sale.get("total", 0)
        
        top_product = max(product_counts.values(), key=lambda x: x["quantity"]) if product_counts else None
        
        # Tienda top (si hay múltiples tiendas)
        store_totals = defaultdict(lambda: {"name": "", "total": 0, "count": 0})
        account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0, "stores": 1})
        stores = account.get("stores", []) if account else []
        
        for sale in current_sales:
            store_code = sale.get("store", "")
            store_name = next((s.get("name") for s in stores if s.get("code") == store_code), store_code)
            store_totals[store_code]["name"] = store_name
            store_totals[store_code]["total"] += sale.get("total", 0)
            store_totals[store_code]["count"] += 1
        
        top_store = max(store_totals.values(), key=lambda x: x["total"]) if len(store_totals) > 1 else None
        
        # Ventas netas (ventas - egresos)
        expense_filter = {
            **get_tenant_filter(current_user.dict()),
            "created_at": {
                "$gte": dates["start"].isoformat(),
                "$lte": dates["end"].isoformat()
            }
        }
        expenses = await db.expenses.find(expense_filter, {"_id": 0, "amount": 1}).to_list(100000)
        total_expenses = sum(exp.get("amount", 0) for exp in expenses)
        net_sales = total_sales - total_expenses
        
        return {
            "period": period,
            "date_range": {
                "start": dates["start"].isoformat(),
                "end": dates["end"].isoformat()
            },
            "kpis": {
                "total_sales": {
                    "value": total_sales,
                    "variation": sales_variation,
                    "previous": prev_total_sales
                },
                "num_sales": {
                    "value": num_sales,
                    "variation": num_sales_variation,
                    "previous": prev_num_sales
                },
                "avg_ticket": {
                    "value": avg_ticket
                },
                "top_product": top_product,
                "top_store": top_store,
                "net_sales": {
                    "value": net_sales,
                    "sales": total_sales,
                    "expenses": total_expenses
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculando KPIs: {str(e)}")


@router.get("/temporal")
async def get_temporal_analytics(
    period: str = Query("month", regex="^(today|week|month|year|custom)$"),
    store_id: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Gráficos temporales:
    - Ventas diarias (últimos 30 días)
    - Ventas mensuales (últimos 12 meses)
    - Ventas por hora del día
    - Ventas por día de semana
    """
    try:
        # Filtro base
        tenant_filter = get_tenant_filter(current_user.dict())
        if store_id and store_id != "all":
            tenant_filter["store"] = store_id
        
        now = datetime.now(timezone.utc)
        
        # 1. Ventas diarias (últimos 30 días)
        thirty_days_ago = now - timedelta(days=30)
        daily_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": thirty_days_ago.isoformat(),
                "$lte": now.isoformat()
            }
        }
        daily_sales = await db.sales.find(daily_filter, {"_id": 0}).to_list(100000)
        
        # Agrupar por día
        daily_data = defaultdict(float)
        for sale in daily_sales:
            created_at = datetime.fromisoformat(sale.get("created_at", "").replace('Z', '+00:00'))
            date_key = created_at.date().isoformat()
            daily_data[date_key] += sale.get("total", 0)
        
        # Formatear para gráfico
        daily_chart = []
        for i in range(30):
            date = (now - timedelta(days=29-i)).date()
            daily_chart.append({
                "date": date.isoformat(),
                "sales": daily_data.get(date.isoformat(), 0)
            })
        
        # Calcular promedio móvil de 7 días
        for i in range(len(daily_chart)):
            if i >= 6:
                avg = sum(daily_chart[j]["sales"] for j in range(i-6, i+1)) / 7
                daily_chart[i]["avg_7_days"] = avg
            else:
                daily_chart[i]["avg_7_days"] = None
        
        # 2. Ventas mensuales (últimos 12 meses)
        twelve_months_ago = now.replace(day=1) - timedelta(days=365)
        monthly_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": twelve_months_ago.isoformat(),
                "$lte": now.isoformat()
            }
        }
        monthly_sales = await db.sales.find(monthly_filter, {"_id": 0}).to_list(100000)
        
        # Agrupar por mes
        monthly_data = defaultdict(float)
        for sale in monthly_sales:
            created_at = datetime.fromisoformat(sale.get("created_at", "").replace('Z', '+00:00'))
            month_key = f"{created_at.year}-{created_at.month:02d}"
            monthly_data[month_key] += sale.get("total", 0)
        
        # Formatear para gráfico
        monthly_chart = []
        current_date = twelve_months_ago.replace(day=1)
        for i in range(12):
            month_key = f"{current_date.year}-{current_date.month:02d}"
            monthly_chart.append({
                "month": month_key,
                "month_name": current_date.strftime("%b %Y"),
                "sales": monthly_data.get(month_key, 0)
            })
            # Siguiente mes
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        # 3. Ventas por hora del día (últimos 30 días)
        hourly_data = defaultdict(float)
        for sale in daily_sales:
            created_at = datetime.fromisoformat(sale.get("created_at", "").replace('Z', '+00:00'))
            hour = created_at.hour
            hourly_data[hour] += sale.get("total", 0)
        
        hourly_chart = [{"hour": h, "sales": hourly_data.get(h, 0)} for h in range(24)]
        
        # 4. Ventas por día de semana (últimos 30 días)
        weekday_data = defaultdict(float)
        weekday_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        for sale in daily_sales:
            created_at = datetime.fromisoformat(sale.get("created_at", "").replace('Z', '+00:00'))
            weekday = created_at.weekday()
            weekday_data[weekday] += sale.get("total", 0)
        
        weekday_chart = [
            {"day": weekday_names[i], "sales": weekday_data.get(i, 0)} 
            for i in range(7)
        ]
        
        return {
            "daily": daily_chart,
            "monthly": monthly_chart,
            "hourly": hourly_chart,
            "weekday": weekday_chart
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en análisis temporal: {str(e)}")


@router.get("/products")
async def get_products_analytics(
    period: str = Query("month"),
    store_id: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Análisis de productos:
    - Top 10 productos por unidades y por ingresos
    - Productos con baja rotación
    """
    try:
        dates = get_date_range(period, start_date, end_date)
        
        tenant_filter = get_tenant_filter(current_user.dict())
        if store_id and store_id != "all":
            tenant_filter["store"] = store_id
        
        sales_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": dates["start"].isoformat(),
                "$lte": dates["end"].isoformat()
            }
        }
        
        sales = await db.sales.find(sales_filter, {"_id": 0}).to_list(100000)
        
        # Agrupar por producto
        product_stats = defaultdict(lambda: {"name": "", "units": 0, "revenue": 0})
        for sale in sales:
            product_name = sale.get("product_name", "Desconocido")
            product_stats[product_name]["name"] = product_name
            product_stats[product_name]["units"] += sale.get("quantity", 0)
            product_stats[product_name]["revenue"] += sale.get("total", 0)
        
        # Top 10 por unidades
        top_by_units = sorted(product_stats.values(), key=lambda x: x["units"], reverse=True)[:10]
        
        # Top 10 por ingresos
        top_by_revenue = sorted(product_stats.values(), key=lambda x: x["revenue"], reverse=True)[:10]
        
        # Productos con baja rotación (los que menos se venden de los que se vendieron)
        low_rotation = sorted(product_stats.values(), key=lambda x: x["units"])[:10]
        
        return {
            "top_by_units": top_by_units,
            "top_by_revenue": top_by_revenue,
            "low_rotation": low_rotation,
            "total_products": len(product_stats)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en análisis de productos: {str(e)}")


@router.get("/stores-payments")
async def get_stores_payments_analytics(
    period: str = Query("month"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Análisis de tiendas y métodos de pago:
    - Comparativa entre tiendas
    - Distribución por método de pago
    """
    try:
        dates = get_date_range(period, start_date, end_date)
        
        tenant_filter = get_tenant_filter(current_user.dict())
        sales_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": dates["start"].isoformat(),
                "$lte": dates["end"].isoformat()
            }
        }
        
        sales = await db.sales.find(sales_filter, {"_id": 0}).to_list(100000)
        
        # Obtener info de tiendas
        account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0, "stores": 1})
        stores = account.get("stores", []) if account else []
        
        # Comparativa de tiendas
        store_stats = defaultdict(lambda: {"name": "", "total": 0, "count": 0, "avg_ticket": 0})
        for sale in sales:
            store_code = sale.get("store", "")
            store_name = next((s.get("name") for s in stores if s.get("code") == store_code), store_code)
            store_stats[store_code]["name"] = store_name
            store_stats[store_code]["total"] += sale.get("total", 0)
            store_stats[store_code]["count"] += 1
        
        # Calcular ticket promedio
        for store_code in store_stats:
            if store_stats[store_code]["count"] > 0:
                store_stats[store_code]["avg_ticket"] = store_stats[store_code]["total"] / store_stats[store_code]["count"]
        
        stores_comparison = list(store_stats.values())
        
        # Métodos de pago
        payment_stats = defaultdict(lambda: {"method": "", "total": 0, "count": 0})
        total_payments = sum(sale.get("total", 0) for sale in sales)
        
        for sale in sales:
            method = sale.get("payment_method", "Otro")
            payment_stats[method]["method"] = method
            payment_stats[method]["total"] += sale.get("total", 0)
            payment_stats[method]["count"] += 1
        
        # Calcular porcentajes
        payment_distribution = []
        for method, stats in payment_stats.items():
            percentage = (stats["total"] / total_payments * 100) if total_payments > 0 else 0
            payment_distribution.append({
                "method": method,
                "total": stats["total"],
                "count": stats["count"],
                "percentage": percentage
            })
        
        return {
            "stores_comparison": stores_comparison,
            "payment_distribution": payment_distribution
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en análisis de tiendas/pagos: {str(e)}")


@router.get("/customers")
async def get_customers_analytics(
    period: str = Query("month"),
    store_id: Optional[str] = Query(None),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Análisis de clientes:
    - Top clientes por compras
    - % ventas identificadas vs anónimas
    - Ticket promedio por tipo de cliente
    - Frecuencia de compra
    """
    try:
        dates = get_date_range(period, start_date, end_date)
        
        tenant_filter = get_tenant_filter(current_user.dict())
        if store_id and store_id != "all":
            tenant_filter["store"] = store_id
        
        sales_filter = {
            **tenant_filter,
            "created_at": {
                "$gte": dates["start"].isoformat(),
                "$lte": dates["end"].isoformat()
            }
        }
        
        sales = await db.sales.find(sales_filter, {"_id": 0}).to_list(100000)
        
        # Top clientes y estadísticas
        customer_stats = defaultdict(lambda: {"name": "", "total": 0, "count": 0, "dates": []})
        identified_sales = 0
        identified_count = 0
        anonymous_sales = 0
        anonymous_count = 0
        
        for sale in sales:
            customer_id = sale.get("customer_id")
            customer_name = sale.get("customer")
            
            if customer_id and customer_name:
                customer_stats[customer_id]["name"] = customer_name
                customer_stats[customer_id]["total"] += sale.get("total", 0)
                customer_stats[customer_id]["count"] += 1
                customer_stats[customer_id]["dates"].append(sale.get("created_at"))
                identified_sales += sale.get("total", 0)
                identified_count += 1
            else:
                anonymous_sales += sale.get("total", 0)
                anonymous_count += 1
        
        # Top 10 clientes con ticket promedio
        for customer_id in customer_stats:
            if customer_stats[customer_id]["count"] > 0:
                customer_stats[customer_id]["avg_ticket"] = customer_stats[customer_id]["total"] / customer_stats[customer_id]["count"]
            else:
                customer_stats[customer_id]["avg_ticket"] = 0
        
        top_customers = sorted(customer_stats.values(), key=lambda x: x["total"], reverse=True)[:10]
        
        # Ticket promedio por tipo de cliente
        avg_ticket_identified = (identified_sales / identified_count) if identified_count > 0 else 0
        avg_ticket_anonymous = (anonymous_sales / anonymous_count) if anonymous_count > 0 else 0
        
        # Porcentajes
        total_sales_value = identified_sales + anonymous_sales
        identified_percentage = (identified_sales / total_sales_value * 100) if total_sales_value > 0 else 0
        anonymous_percentage = (anonymous_sales / total_sales_value * 100) if total_sales_value > 0 else 0
        
        # Clientes nuevos vs recurrentes
        new_customers = sum(1 for c in customer_stats.values() if c["count"] == 1)
        recurring_customers = sum(1 for c in customer_stats.values() if c["count"] > 1)
        
        # Frecuencia promedio de compra (días entre compras)
        frequency_data = []
        for customer in customer_stats.values():
            if customer["count"] > 1:
                dates = sorted([datetime.fromisoformat(d.replace('Z', '+00:00')) for d in customer["dates"]])
                intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates) - 1)]
                avg_interval = sum(intervals) / len(intervals) if intervals else 0
                frequency_data.append(avg_interval)
        
        avg_purchase_frequency = sum(frequency_data) / len(frequency_data) if frequency_data else 0
        
        return {
            "top_customers": top_customers,
            "identified_vs_anonymous": {
                "identified": {
                    "total": identified_sales,
                    "count": identified_count,
                    "percentage": identified_percentage,
                    "avg_ticket": avg_ticket_identified
                },
                "anonymous": {
                    "total": anonymous_sales,
                    "count": anonymous_count,
                    "percentage": anonymous_percentage,
                    "avg_ticket": avg_ticket_anonymous
                }
            },
            "new_vs_recurring": {
                "new": new_customers,
                "recurring": recurring_customers,
                "total": len(customer_stats)
            },
            "avg_purchase_frequency_days": avg_purchase_frequency
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en análisis de clientes: {str(e)}")
