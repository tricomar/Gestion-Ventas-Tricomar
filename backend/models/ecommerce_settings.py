"""
Pydantic models for ecommerce configuration
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class EcommerceSettings(BaseModel):
    """Settings for ecommerce badge and notifications"""
    account_id: str
    
    # Estados que activan el badge (pedidos que requieren atención)
    badge_states: List[str] = Field(
        default=["1", "2", "3", "10", "12"],
        description="Estados de PrestaShop que activan el badge rojo"
    )
    
    # Nombres de estados para UI (mapeo estado_id -> nombre)
    state_names: dict = Field(
        default={
            "1": "Pago pendiente",
            "2": "Pago aceptado",
            "3": "En preparación",
            "4": "Enviado",
            "5": "Entregado",
            "6": "Cancelado",
            "7": "Reembolsado",
            "8": "Error de pago",
            "9": "Pendiente reabastecimiento",
            "10": "Esperando pago bancario",
            "11": "Pago remoto aceptado",
            "12": "Pago Webpay aceptado"
        }
    )
    
    # Estados finales que NO requieren acción
    final_states: List[str] = Field(
        default=["4", "5", "6", "7"],
        description="Estados finales: Enviado, Entregado, Cancelado, Reembolsado"
    )

class BadgeResponse(BaseModel):
    """Response model for badge count"""
    count: int
    pending_orders: List[dict] = []
