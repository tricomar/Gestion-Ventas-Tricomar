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
from models.ecommerce_settings import EcommerceSettings, BadgeResponse
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
        
        # Today's sales - usar date_add (fecha real del pedido)
        today_filter = {
            **tenant_filter,
            "date_add": {"$gte": today_start, "$lte": today_end}
        }
        today_orders = await db.ecommerce_orders.find(today_filter, {"_id": 0, "total_paid": 1}).to_list(10000)
        today_sales = sum(float(o.get("total_paid", 0)) for o in today_orders)
        
        # Monthly sales - usar date_add (fecha real del pedido)
        month_filter = {
            **tenant_filter,
            "date_add": {"$gte": month_start, "$lte": month_end}
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
    state: str = None,
    store_code: str = None,
    current_user: User = Depends(get_current_user)
):
    """Obtener últimas órdenes de ecommerce con filtros opcionales"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Agregar filtros opcionales
        if state:
            tenant_filter["current_state"] = state
        if store_code:
            tenant_filter["store_code"] = store_code
        
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

@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle completo de un pedido"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {"id": order_id})
        
        order = await db.ecommerce_orders.find_one(
            tenant_filter,
            {"_id": 0}
        )
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Orden no encontrada"
            )
        
        # Mapeo de estados de PrestaShop
        state_names = {
            "1": "Esperando pago con cheque",
            "2": "Pago aceptado",
            "3": "Preparación en curso",
            "4": "Enviado",
            "5": "Entregado",
            "6": "Cancelado",
            "7": "Reembolsado",
            "8": "Error de pago",
            "10": "Esperando transferencia bancaria",
            "12": "Pago remoto aceptado",
            "13": "En espera de reabastecimiento",
            "35": "Esperando confirmación"
        }
        
        # Asegurar que state_name existe
        if not order.get('state_name'):
            state_id = str(order.get('current_state', ''))
            order['state_name'] = state_names.get(state_id, f"Estado {state_id}")
        
        # Asegurar que items existe (aunque esté vacío)
        if 'items' not in order:
            order['items'] = []
        
        # Asegurar que customer_email existe
        if not order.get('customer_email'):
            order['customer_email'] = 'No disponible'
        
        # Si customer_name está vacío, poner placeholder
        if not order.get('customer_name') or order.get('customer_name').strip() == '':
            order['customer_name'] = f'Cliente #{order.get("customer_id", "N/A")}'
        
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener orden: {str(e)}"
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
        state_name = update_data.get("state_name", "")
        
        if not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estado requerido"
            )
        
        # Actualizar estado
        update_fields = {
            "current_state": new_status,
            "status": new_status,
            "date_upd": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if state_name:
            update_fields["state_name"] = state_name
        
        result = await db.ecommerce_orders.update_one(
            tenant_filter,
            {"$set": update_fields}
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

@router.get("/order-states")
async def get_order_states(
    current_user: User = Depends(get_current_user)
):
    """Obtener lista de estados de pedidos disponibles basados en pedidos existentes y PrestaShop"""
    try:
        # Mapeo de estados comunes de PrestaShop
        default_state_names = {
            "1": "Esperando pago con cheque",
            "2": "Pago aceptado",
            "3": "Preparación en curso",
            "4": "Enviado",
            "5": "Entregado",
            "6": "Cancelado",
            "7": "Reembolsado",
            "8": "Error de pago",
            "9": "En espera de reabastecimiento",
            "10": "Esperando transferencia bancaria",
            "11": "Pago remoto aceptado",
            "12": "Pago remoto aceptado",
            "13": "En espera de reabastecimiento",
            "35": "Esperando confirmación"
        }
        
        # Obtener estados únicos de los pedidos del usuario
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        pipeline = [
            {"$match": tenant_filter},
            {"$group": {
                "_id": "$current_state",
                "state_name": {"$first": "$state_name"}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        states_from_orders = await db.ecommerce_orders.aggregate(pipeline).to_list(100)
        
        # Convertir a formato esperado
        states = []
        for state in states_from_orders:
            if state['_id']:  # Ignorar nulls
                state_id = str(state['_id'])
                # Usar state_name del pedido si existe, sino usar el mapeo por defecto
                state_name = state.get('state_name') or default_state_names.get(state_id, f"Estado {state_id}")
                
                states.append({
                    "id": state_id,
                    "name": state_name
                })
        
        # Si no hay pedidos, devolver estados por defecto de PrestaShop
        if not states:
            for state_id, state_name in default_state_names.items():
                states.append({
                    "id": state_id,
                    "name": state_name
                })
        
        return states
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estados: {str(e)}"
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



@router.get("/badge-config")
async def get_badge_config(current_user: User = Depends(get_current_user)):
    """Obtener configuración del badge de ecommerce"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Buscar configuración existente
        config = await db.ecommerce_settings.find_one(tenant_filter, {"_id": 0})
        
        if not config:
            # Crear configuración por defecto
            default_config = EcommerceSettings(account_id=current_user.account_id)
            await db.ecommerce_settings.insert_one(default_config.dict())
            return default_config.dict()
        
        return config
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener configuración: {str(e)}"
        )


@router.put("/badge-config")
async def update_badge_config(
    badge_states: List[str],
    current_user: User = Depends(get_current_user)
):
    """Actualizar estados que activan el badge"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        result = await db.ecommerce_settings.update_one(
            tenant_filter,
            {
                "$set": {
                    "badge_states": badge_states,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {"success": True, "badge_states": badge_states}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar configuración: {str(e)}"
        )


@router.get("/badge-count", response_model=BadgeResponse)
async def get_badge_count(current_user: User = Depends(get_current_user)):
    """Obtener contador del badge (pedidos pendientes)"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Obtener configuración
        config = await db.ecommerce_settings.find_one(tenant_filter, {"_id": 0})
        
        if not config:
            # Usar configuración por defecto
            default_config = EcommerceSettings(account_id=current_user.account_id)
            badge_states = default_config.badge_states
        else:
            badge_states = config.get('badge_states', ["1", "2", "3", "10", "12"])
        
        # Contar órdenes en estados pendientes
        pending_filter = {
            **tenant_filter,
            "current_state": {"$in": badge_states}
        }
        
        count = await db.ecommerce_orders.count_documents(pending_filter)
        
        # Obtener detalles de órdenes pendientes (últimas 10)
        pending_orders = await db.ecommerce_orders.find(
            pending_filter,
            {"_id": 0, "order_id": 1, "reference": 1, "current_state": 1, "total_paid": 1, "created_at": 1}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        return BadgeResponse(
            count=count,
            pending_orders=pending_orders
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener contador de badge: {str(e)}"
        )
