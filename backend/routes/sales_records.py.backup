"""
Router para registros históricos de ventas
Endpoints para consultar ventas por día, mes y año
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from calendar import monthrange

from models.users import User
from utils import db, get_current_user, require_admin

router = APIRouter(prefix="/sales-records", tags=["sales-records"])

@router.get("/calendar/{year}/{month}")
async def get_sales_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene las ventas del mes en formato calendario
    Retorna totales por día, total del mes y del año
    """
    try:
        # Validar mes y año
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Mes inválido")
        if year < 2000 or year > 2100:
            raise HTTPException(status_code=400, detail="Año inválido")
        
        # Construir fechas de inicio y fin del mes
        start_date = f"{year}-{month:02d}-01T00:00:00"
        _, last_day = monthrange(year, month)
        end_date = f"{year}-{month:02d}-{last_day}T23:59:59"
        
        # Obtener todas las ventas del mes
        sales = await db.sales.find({
            "date": {
                "$gte": start_date,
                "$lte": end_date
            }
        }, {"_id": 0}).to_list(10000)
        
        # Agrupar por día
        daily_totals = {}
        monthly_total = 0
        
        for sale in sales:
            # Extraer día de la fecha
            sale_date = sale.get("date", "")
            if sale_date:
                day = int(sale_date.split("T")[0].split("-")[2])
                total = sale.get("total", 0)
                
                if day not in daily_totals:
                    daily_totals[day] = 0
                daily_totals[day] += total
                monthly_total += total
        
        # Obtener total del año
        year_start = f"{year}-01-01T00:00:00"
        year_end = f"{year}-12-31T23:59:59"
        
        year_sales = await db.sales.find({
            "date": {
                "$gte": year_start,
                "$lte": year_end
            }
        }, {"_id": 0, "total": 1}).to_list(100000)
        
        yearly_total = sum(sale.get("total", 0) for sale in year_sales)
        
        return {
            "year": year,
            "month": month,
            "daily_totals": daily_totals,
            "monthly_total": monthly_total,
            "yearly_total": yearly_total,
            "total_sales_count": len(sales)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener datos del calendario: {str(e)}"
        )

@router.get("/day/{date}")
async def get_day_sales(
    date: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene todas las ventas de un día específico
    Formato de fecha: YYYY-MM-DD
    """
    try:
        # Validar formato de fecha
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
        
        start_datetime = f"{date}T00:00:00"
        end_datetime = f"{date}T23:59:59"
        
        # Obtener ventas del día
        sales = await db.sales.find({
            "date": {
                "$gte": start_datetime,
                "$lte": end_datetime
            }
        }, {"_id": 0}).to_list(1000)
        
        # Calcular total
        total = sum(sale.get("total", 0) for sale in sales)
        
        return {
            "date": date,
            "sales": sales,
            "total": total,
            "count": len(sales)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener ventas del día: {str(e)}"
        )

@router.get("/month-summary/{year}/{month}")
async def get_month_summary(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene un resumen detallado del mes
    """
    try:
        start_date = f"{year}-{month:02d}-01T00:00:00"
        _, last_day = monthrange(year, month)
        end_date = f"{year}-{month:02d}-{last_day}T23:59:59"
        
        sales = await db.sales.find({
            "date": {
                "$gte": start_date,
                "$lte": end_date
            }
        }, {"_id": 0}).to_list(10000)
        
        total_revenue = sum(sale.get("total", 0) for sale in sales)
        total_cost = sum(sale.get("cost_price", 0) * sale.get("quantity", 0) for sale in sales)
        total_profit = total_revenue - total_cost
        
        # Agrupar por producto
        products_summary = {}
        for sale in sales:
            product_name = sale.get("product_name", "Desconocido")
            if product_name not in products_summary:
                products_summary[product_name] = {
                    "quantity": 0,
                    "revenue": 0
                }
            products_summary[product_name]["quantity"] += sale.get("quantity", 0)
            products_summary[product_name]["revenue"] += sale.get("total", 0)
        
        return {
            "year": year,
            "month": month,
            "total_revenue": total_revenue,
            "total_cost": total_cost,
            "total_profit": total_profit,
            "total_sales": len(sales),
            "products_summary": products_summary
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener resumen del mes: {str(e)}"
        )

@router.get("/year-summary/{year}")
async def get_year_summary(
    year: int,
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene un resumen del año con totales por mes
    """
    try:
        year_start = f"{year}-01-01T00:00:00"
        year_end = f"{year}-12-31T23:59:59"
        
        sales = await db.sales.find({
            "date": {
                "$gte": year_start,
                "$lte": year_end
            }
        }, {"_id": 0}).to_list(100000)
        
        # Agrupar por mes
        monthly_totals = {i: 0 for i in range(1, 13)}
        
        for sale in sales:
            sale_date = sale.get("date", "")
            if sale_date:
                month = int(sale_date.split("T")[0].split("-")[1])
                monthly_totals[month] += sale.get("total", 0)
        
        total_year = sum(monthly_totals.values())
        
        return {
            "year": year,
            "monthly_totals": monthly_totals,
            "yearly_total": total_year,
            "total_sales": len(sales)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener resumen del año: {str(e)}"
        )
