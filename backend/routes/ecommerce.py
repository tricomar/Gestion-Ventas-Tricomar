"""
Router para gestión de ecommerce (órdenes, clientes, mensajes)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import httpx

from utils import db, get_current_user
from models.users import User
from middleware.tenant import get_tenant_filter
from pydantic import BaseModel

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

router = APIRouter(prefix="/ecommerce", tags=["ecommerce"])

class MessageCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_email: str
    message: str
    order_id: Optional[str] = None

@router.get("/stats")
async def get_ecommerce_stats(current_user: User = Depends(get_current_user)):
    """Obtener estadísticas de ecommerce con timezone configurado"""
    try:
        from utils.timezone_utils import (
            get_day_boundaries_utc,
            get_month_boundaries_utc,
            now_local,
            get_account_currency
        )
        from routes.dashboard import get_account_timezone
        
        # Get timezone and currency
        user_tz_str = await get_account_timezone(current_user.account_id)
        currency_config = await get_account_currency(current_user.account_id)
        local_now = now_local(user_tz_str)
        
        # Get boundaries for today
        today_str = local_now.strftime("%Y-%m-%d")
        today_start, today_end = get_day_boundaries_utc(today_str, user_tz_str)
        
        # Get boundaries for current month
        month_start, month_end = get_month_boundaries_utc(
            local_now.year,
            local_now.month,
            user_tz_str
        )
        
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Total orders
        total_orders = await db.ecommerce_orders.count_documents(tenant_filter)
        
        # Pending orders (estados que requieren acción)
        pending_filter = {
            **tenant_filter,
            "current_state": {"$in": ["1", "2", "3", "10"]}  # Payment accepted, Processing, Prepared, Awaiting payment
        }
        pending_orders = await db.ecommerce_orders.count_documents(pending_filter)
        
        # Today's sales
        today_filter = {
            **tenant_filter,
            "created_at": {"$gte": today_start, "$lte": today_end}
        }
        today_orders = await db.ecommerce_orders.find(today_filter, {"_id": 0, "total_paid": 1}).to_list(10000)
        today_sales = sum(float(o.get("total_paid", 0)) for o in today_orders)
        
        # Monthly sales
        month_filter = {
            **tenant_filter,
            "created_at": {"$gte": month_start, "$lte": month_end}
        }
        month_orders = await db.ecommerce_orders.find(month_filter, {"_id": 0, "total_paid": 1}).to_list(10000)
        monthly_sales = sum(float(o.get("total_paid", 0)) for o in month_orders)
        
        # New customers (this month)
        new_customers_filter = {
            **tenant_filter,
            "created_at": {"$gte": month_start, "$lte": month_end}
        }
        new_customers = await db.ecommerce_customers.count_documents(new_customers_filter)
        
        # Abandoned carts
        abandoned_carts = await db.ecommerce_carts.count_documents({
            **tenant_filter,
            "id_order": {"$exists": False}
        })
        
        return {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "today_sales": today_sales,
            "today_orders": len(today_orders),
            "monthly_sales": monthly_sales,
            "monthly_orders": len(month_orders),
            "new_customers": new_customers,
            "abandoned_carts": abandoned_carts,
            "currency_symbol": currency_config['symbol'],
            "currency_code": currency_config['code'],
            "timezone": user_tz_str
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estadísticas: {str(e)}"
        )

@router.get("/orders")
async def get_orders(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Obtener últimas órdenes de ecommerce"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Obtener órdenes ordenadas por fecha descendente
        orders_cursor = db.ecommerce_orders.find(
            tenant_filter,
            {"_id": 0}
        ).sort("date_add", -1).limit(limit)
        
        orders = await orders_cursor.to_list(limit)
        
        return orders
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener órdenes: {str(e)}"
        )

@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    update_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Actualizar estado de una orden"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {"id": order_id})
        
        new_status = update_data.get("status")
        if not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estado requerido"
            )
        
        # Actualizar estado
        result = await db.ecommerce_orders.update_one(
            tenant_filter,
            {
                "$set": {
                    "current_state": new_status,
                    "status": new_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Orden no encontrada"
            )
        
        # TODO: Si hay integración de PrestaShop activa, actualizar también en PrestaShop
        # Esto requeriría llamar a la API de PrestaShop para actualizar el estado de la orden
        
        return {"success": True, "message": "Estado actualizado correctamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar estado: {str(e)}"
        )

@router.get("/customers")
async def get_customers(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """Obtener últimos clientes registrados"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        customers_cursor = db.ecommerce_customers.find(
            tenant_filter,
            {"_id": 0}
        ).sort("date_add", -1).limit(limit)
        
        customers = await customers_cursor.to_list(limit)
        
        return customers
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener clientes: {str(e)}"
        )

@router.get("/guest-emails")
async def get_guest_emails(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Obtener correos de clientes invitados (sin cuenta)"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Buscar órdenes de invitados
        # En PrestaShop, los invitados tienen id_customer = 0 o guest = 1
        guest_filter = {
            **tenant_filter,
            "$or": [
                {"id_customer": "0"},
                {"guest": 1}
            ]
        }
        
        orders_cursor = db.ecommerce_orders.find(
            guest_filter,
            {"_id": 0, "customer_email": 1}
        ).limit(limit)
        
        orders = await orders_cursor.to_list(limit)
        
        # Extraer emails únicos
        emails = list(set(order.get("customer_email", "") for order in orders if order.get("customer_email")))
        
        return emails[:limit]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener correos de invitados: {str(e)}"
        )

@router.post("/messages")
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Enviar mensaje a un cliente"""
    try:
        # Guardar mensaje en base de datos
        message_doc = {
            "id": str(datetime.now(timezone.utc).timestamp()),
            "customer_id": message_data.customer_id,
            "customer_email": message_data.customer_email,
            "order_id": message_data.order_id,
            "message": message_data.message,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "sent"
        }
        
        # Agregar account_id para tenant isolation
        from middleware.tenant import add_account_id_to_document
        message_doc = add_account_id_to_document(current_user.dict(), message_doc)
        
        await db.ecommerce_messages.insert_one(message_doc)
        
        # TODO: Implementar envío real de email
        # Esto requeriría integración con servicio de email (SendGrid, Resend, etc.)
        # Por ahora solo guardamos el mensaje en la BD
        
        return {
            "success": True,
            "message": "Mensaje enviado correctamente",
            "id": message_doc["id"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al enviar mensaje: {str(e)}"
        )

@router.get("/carts/abandoned")
async def get_abandoned_carts(
    limit: int = 50,
    integration_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Obtener carritos abandonados"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Filtrar por integración si se especifica
        if integration_id:
            tenant_filter["integration_id"] = integration_id
        
        # Buscar carritos abandonados (no finalizados)
        abandoned_filter = {
            **tenant_filter,
            "$or": [
                {"id_order": {"$exists": False}},
                {"id_order": None},
                {"id_order": "0"}
            ]
        }
        
        carts_cursor = db.ecommerce_carts.find(
            abandoned_filter,
            {"_id": 0}
        ).sort("date_add", -1).limit(limit)
        
        carts = await carts_cursor.to_list(limit)
        
        return carts
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener carritos abandonados: {str(e)}"
        )

@router.get("/carts/finalized")
async def get_finalized_carts(
    limit: int = 50,
    integration_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Obtener carritos finalizados (con orden de compra)"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Filtrar por integración si se especifica
        if integration_id:
            tenant_filter["integration_id"] = integration_id
        
        # Buscar carritos finalizados (con orden asociada)
        finalized_filter = {
            **tenant_filter,
            "id_order": {"$exists": True, "$nin": [None, "0"]}
        }
        
        carts_cursor = db.ecommerce_carts.find(
            finalized_filter,
            {"_id": 0}
        ).sort("date_add", -1).limit(limit)
        
        carts = await carts_cursor.to_list(limit)
        
        return carts
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener carritos finalizados: {str(e)}"
        )
