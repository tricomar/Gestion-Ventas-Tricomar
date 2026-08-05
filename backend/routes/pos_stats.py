"""
Estadísticas del POS para el día actual
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Dict

from models.users import User
from utils import db, get_current_user
from middleware.tenant import get_tenant_filter

router = APIRouter(prefix="/pos-stats", tags=["POS Stats"])

@router.get("/today")
async def get_today_stats(current_user: User = Depends(get_current_user)) -> Dict:
    """Obtener estadísticas del día actual para el POS"""
    try:
        # Fecha de hoy
        today = datetime.now(timezone.utc).date()
        today_str = today.isoformat()
        
        # Filtro de tenant
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # VENTAS DEL DÍA
        sales_filter = {**tenant_filter, 'date': today_str}
        sales = await db.sales.find(sales_filter, {'_id': 0}).to_list(None)
        
        # Agrupar ventas por método de pago
        ventas_efectivo = sum(s.get('total', 0) for s in sales if s.get('payment_method') == 'Efectivo')
        ventas_tarjeta = sum(s.get('total', 0) for s in sales if s.get('payment_method') == 'Tarjeta')
        ventas_transferencia = sum(s.get('total', 0) for s in sales if s.get('payment_method') == 'Transferencia')
        total_ventas = ventas_efectivo + ventas_tarjeta + ventas_transferencia
        
        # EGRESOS DEL DÍA
        expenses_filter = {**tenant_filter, 'date': today_str}
        expenses = await db.expenses.find(expenses_filter, {'_id': 0}).to_list(None)
        total_egresos = sum(e.get('amount', 0) for e in expenses)
        
        # INGRESOS EXTRAS DEL DÍA
        incomes_filter = {**tenant_filter, 'date': today_str}
        incomes = await db.income.find(incomes_filter, {'_id': 0}).to_list(None)
        total_ingresos_extras = sum(i.get('amount', 0) for i in incomes)
        
        return {
            'date': today_str,
            'ventas': {
                'efectivo': ventas_efectivo,
                'tarjeta': ventas_tarjeta,
                'transferencia': ventas_transferencia,
                'total': total_ventas,
                'count': len(sales)
            },
            'egresos': {
                'total': total_egresos,
                'count': len(expenses)
            },
            'ingresos_extras': {
                'total': total_ingresos_extras,
                'count': len(incomes)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
