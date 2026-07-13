from pydantic import BaseModel
from typing import Dict, List, Any

class RealtimeMetrics(BaseModel):
    store_a_day: Dict[str, float]
    store_b_day: Dict[str, float]
    store_a_month: Dict[str, float]
    store_b_month: Dict[str, float]
    general_day: Dict[str, float]  # Otros Ingresos y Egresos (día)
    general_month: Dict[str, float]  # Otros Ingresos y Egresos (mes)

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
