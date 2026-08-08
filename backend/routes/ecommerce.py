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
            "status": "abandoned"
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
        
        # Asegurar que items existe
        if 'items' not in order or not order['items']:
            # Intentar obtener productos desde PrestaShop
            try:
                # Buscar integraciones activas del usuario
                # Como integration_id en orden no coincide con _id de integración,
                # usamos la primera integración activa del usuario
                integration = await db.prestashop_integrations.find_one({
                    "account_id": current_user.account_id,
                    "is_active": True
                }, {"_id": 0, "shop_url": 1, "api_key": 1})
                
                if integration:
                    from services.prestashop_service import PrestashopAPIService
                    
                    ps_service = PrestashopAPIService(
                        shop_url=integration['shop_url'],
                        api_key=integration['api_key']
                    )
                    
                    # Obtener detalles completos del pedido desde PrestaShop
                    ps_order = ps_service.get_order_details(int(order.get('id')))
                    
                    if ps_order and 'processed_items' in ps_order:
                        order['items'] = ps_order['processed_items']
                        print(f"✅ Loaded {len(order['items'])} items from PrestaShop for order {order.get('id')}")
                    else:
                        order['items'] = []
                        print(f"⚠️ No items returned from PrestaShop for order {order.get('id')}")
                else:
                    order['items'] = []
                    print(f"⚠️ No active integration found for account {current_user.account_id}")
            except Exception as e:
                print(f"❌ Error fetching items from PrestaShop: {e}")
                import traceback
                traceback.print_exc()
                order['items'] = []
        else:
            order['items'] = []
        
        # Si aún no hay items, asegurar lista vacía
        if 'items' not in order:
            order['items'] = []
        
        # Enriquecer el nombre del estado si solo tenemos el código
        if order.get('current_state') and (not order.get('state_name') or order['state_name'] == str(order['current_state'])):
            # Intentar obtener el nombre real del estado desde la integración
            if order.get('integration_id'):
                try:
                    from bson import ObjectId
                    
                    integration_query = {
                        "account_id": current_user.account_id,
                        "is_active": True
                    }
                    
                    try:
                        integration_query["_id"] = ObjectId(order['integration_id'])
                    except (ValueError, TypeError):
                        integration_query["integration_id"] = order['integration_id']
                    
                    integration = await db.prestashop_integrations.find_one(
                        integration_query,
                        {"_id": 0, "shop_url": 1, "api_key": 1}
                    )
                    
                    if integration:
                        from services.prestashop_service import PrestashopAPIService
                        
                        ps_service = PrestashopAPIService(
                            shop_url=integration['shop_url'],
                            api_key=integration['api_key']
                        )
                        
                        # Obtener estados desde PrestaShop
                        states = ps_service.get_order_states()
                        
                        # Buscar el estado actual
                        current_state_id = str(order['current_state'])
                        matching_state = next((s for s in states if s['id'] == current_state_id), None)
                        
                        if matching_state and matching_state.get('name'):
                            order['state_name'] = matching_state['name']
                except Exception as e:
                    print(f"Error enriching state name: {e}")
        
        # Asegurar que customer_email existe
        if not order.get('customer_email'):
            order['customer_email'] = 'No disponible'
        
        # Si customer_name está vacío, intentar obtenerlo de ecommerce_customers o PrestaShop
        if not order.get('customer_name') or order.get('customer_name').strip() == '':
            customer_id = order.get('customer_id')
            
            if customer_id:
                # Primero intentar desde la tabla de clientes ecommerce local
                customer = await db.ecommerce_customers.find_one({
                    "account_id": current_user.account_id,
                    "customer_id": str(customer_id)
                }, {"_id": 0, "name": 1, "firstname": 1, "lastname": 1})
                
                if customer:
                    # Usar nombre completo si existe
                    if customer.get('name'):
                        order['customer_name'] = customer['name']
                    elif customer.get('firstname') or customer.get('lastname'):
                        firstname = customer.get('firstname', '').strip()
                        lastname = customer.get('lastname', '').strip()
                        order['customer_name'] = f"{firstname} {lastname}".strip()
                
                # Si todavía no tenemos nombre, placeholder
                if not order.get('customer_name') or order.get('customer_name').strip() == '':
                    order['customer_name'] = f'Cliente #{customer_id}'
            else:
                order['customer_name'] = 'Cliente desconocido'
        
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
    """Obtener lista de estados de pedidos desde PrestaShop (estados reales incluyendo módulos)"""
    try:
        # Obtener integraciones activas del usuario
        integrations = await db.prestashop_integrations.find({
            "account_id": current_user.account_id,
            "is_active": True
        }).to_list(10)
        
        if not integrations:
            # Si no hay integraciones, retornar estados por defecto
            default_states = [
                {"id": "2", "name": "Pago aceptado", "color": "#32CD32"},
                {"id": "3", "name": "Preparación en curso", "color": "#FF8C00"},
                {"id": "4", "name": "Enviado", "color": "#8A2BE2"},
                {"id": "5", "name": "Entregado", "color": "#228B22"},
                {"id": "6", "name": "Cancelado", "color": "#DC143C"},
                {"id": "7", "name": "Reembolsado", "color": "#EC2E15"}
            ]
            return default_states
        
        # Obtener estados desde la primera integración activa
        # (en caso de múltiples tiendas, podrían tener estados distintos)
        integration = integrations[0]
        
        from services.prestashop_service import PrestashopAPIService
        
        ps_service = PrestashopAPIService(
            shop_url=integration['shop_url'],
            api_key=integration['api_key']
        )
        
        # Obtener estados reales desde PrestaShop
        states = ps_service.get_order_states()
        
        # Filtrar estados eliminados u ocultos si es necesario
        # Por ahora retornamos todos para máxima transparencia
        # El usuario puede ver estados de módulos, ocultos, etc.
        
        return states
        
    except Exception as e:
        print(f"Error getting order states: {str(e)}")
        # En caso de error, retornar estados básicos
        return [
            {"id": "2", "name": "Pago aceptado", "color": "#32CD32"},
            {"id": "3", "name": "Preparación en curso", "color": "#FF8C00"},
            {"id": "4", "name": "Enviado", "color": "#8A2BE2"},
            {"id": "5", "name": "Entregado", "color": "#228B22"},
            {"id": "6", "name": "Cancelado", "color": "#DC143C"}
        ]

@router.get("/carts")
async def get_carts(
    status: str = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Obtener carritos de ecommerce con filtros opcionales"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Agregar filtro de estado si se proporciona
        if status:
            # Mapear 'converted' a 'completed' para consulta BD
            query_status = 'completed' if status == 'converted' else status
            tenant_filter["status"] = query_status
        
        # Obtener carritos ordenados por fecha descendente
        carts_cursor = db.ecommerce_carts.find(
            tenant_filter,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit)
        
        carts = await carts_cursor.to_list(limit)
        
        return carts
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener carritos: {str(e)}"
        )

@router.get("/carts/stats")
async def get_carts_stats(
    current_user: User = Depends(get_current_user)
):
    """Obtener estadísticas de carritos"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        
        # Contar carritos por estado
        pipeline = [
            {"$match": tenant_filter},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_value": {"$sum": "$total_products"}
            }}
        ]
        
        stats_by_status = await db.ecommerce_carts.aggregate(pipeline).to_list(100)
        
        # Formatear resultados
        stats = {
            "active": 0,
            "abandoned": 0,
            "converted": 0,
            "active_value": 0,
            "abandoned_value": 0,
            "converted_value": 0
        }
        
        for stat in stats_by_status:
            status_key = stat['_id']
            # Mapear 'completed' a 'converted' para consistencia
            if status_key == 'completed':
                status_key = 'converted'
            
            if status_key in stats:
                stats[status_key] = stat['count']
                stats[f"{status_key}_value"] = round(stat['total_value'], 2)
        
        # Calcular tasa de abandono
        total_carts = stats['active'] + stats['abandoned'] + stats['converted']
        if total_carts > 0:
            stats['abandonment_rate'] = round((stats['abandoned'] / total_carts) * 100, 1)
        else:
            stats['abandonment_rate'] = 0
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estadísticas de carritos: {str(e)}"
        )

@router.get("/carts/{cart_id}")
async def get_cart_detail(
    cart_id: str,
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle completo de un carrito"""
    try:
        tenant_filter = get_tenant_filter(current_user.dict(), {"cart_id": cart_id})
        
        cart = await db.ecommerce_carts.find_one(
            tenant_filter,
            {"_id": 0}
        )
        
        if not cart:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Carrito no encontrado"
            )
        
        return cart
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener detalle del carrito: {str(e)}"
        )


@router.get("/customers")
async def get_customers(
    customer_type: str = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Obtener lista de clientes de ecommerce"""
    try:
        # Usar filtro simple de account_id en lugar de get_tenant_filter
        base_filter = {"account_id": current_user.account_id}
        
        # Agregar filtro de tipo si se proporciona
        if customer_type:
            if customer_type == "new":
                base_filter["is_new"] = True
            elif customer_type == "recurring":
                base_filter["is_recurring"] = True
            elif customer_type == "one-time":
                base_filter["is_recurring"] = False
                base_filter["is_new"] = False
        
        # Obtener clientes ordenados por total gastado
        customers_cursor = db.ecommerce_customers.find(
            base_filter,
            {"_id": 0}
        ).sort("total_spent", -1).limit(limit)
        
        customers = await customers_cursor.to_list(limit)
        
        return customers
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener clientes: {str(e)}"
        )

@router.get("/customers/stats")
async def get_customers_stats(
    current_user: User = Depends(get_current_user)
):
    """Obtener estadísticas de clientes"""
    try:
        base_filter = {"account_id": current_user.account_id}
        
        # Total de clientes
        total_customers = await db.ecommerce_customers.count_documents(base_filter)
        
        # Clientes nuevos (últimos 30 días)
        new_customers = await db.ecommerce_customers.count_documents({
            **base_filter,
            "is_new": True
        })
        
        # Clientes recurrentes (más de 1 pedido)
        recurring_customers = await db.ecommerce_customers.count_documents({
            **base_filter,
            "is_recurring": True
        })
        
        # Calcular promedios
        pipeline = [
            {"$match": base_filter},
            {"$group": {
                "_id": None,
                "avg_order_value": {"$avg": "$average_order_value"},
                "avg_orders_per_customer": {"$avg": "$order_count"},
                "total_revenue": {"$sum": "$total_spent"}
            }}
        ]
        
        avg_stats = await db.ecommerce_customers.aggregate(pipeline).to_list(1)
        
        stats = {
            "total_customers": total_customers,
            "new_customers": new_customers,
            "recurring_customers": recurring_customers,
            "one_time_customers": total_customers - recurring_customers,
            "avg_order_value": round(avg_stats[0]['avg_order_value'], 2) if avg_stats else 0,
            "avg_orders_per_customer": round(avg_stats[0]['avg_orders_per_customer'], 1) if avg_stats else 0,
            "total_revenue": round(avg_stats[0]['total_revenue'], 2) if avg_stats else 0,
            "recurring_rate": round((recurring_customers / total_customers * 100), 1) if total_customers > 0 else 0
        }
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener estadísticas de clientes: {str(e)}"
        )

@router.get("/customers/{customer_id}")
async def get_customer_detail(
    customer_id: str,
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle completo de un cliente"""
    try:
        base_filter = {
            "account_id": current_user.account_id,
            "customer_id": customer_id
        }
        
        customer = await db.ecommerce_customers.find_one(
            base_filter,
            {"_id": 0}
        )
        
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado"
            )
        
        return customer
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener cliente: {str(e)}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener carrito: {str(e)}"
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
