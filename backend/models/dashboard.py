from pydantic import BaseModel
from typing import Dict, List, Any

class RealtimeMetrics(BaseModel):
    stores_day: Dict[str, Dict[str, float]]  # {"store_id": {compras, iva_a_favor, utilidades}}
    stores_month: Dict[str, Dict[str, float]]
    general_day: Dict[str, float]  # Otros Ingresos y Egresos (día)
    general_month: Dict[str, float]  # Otros Ingresos y Egresos (mes)
    store_info: List[Dict[str, Any]]  # Información de las tiendas: [{id, name, code, color}]
    today_sales: float = 0  # Total de ventas del día

class DashboardStats(BaseModel):
    today_sales: float
    today_expenses: float
    today_other_income: float
    today_net: float
    monthly_sales: float
    monthly_expenses: float
    monthly_net: float
    sales_by_payment_method: Dict[str, float]
    top_products: List[Dict[str, Any]]
    daily_sales_trend: List[Dict[str, Any]]
