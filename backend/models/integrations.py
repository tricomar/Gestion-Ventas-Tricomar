"""
Modelos para integraciones con plataformas ecommerce
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class PrestashopIntegration(BaseModel):
    """Configuración de integración con PrestaShop"""
    id: str
    account_id: str
    store_id: str  # ID de la tienda/caja local a la que pertenece
    store_name: str  # Nombre de la tienda/caja
    shop_url: str  # URL de la tienda PrestaShop (ej: https://tricomarpets.cl)
    api_key: str  # API Key encriptada
    is_active: bool = True
    webhook_active: bool = False  # ✅ Detección de webhook configurado
    last_sync_products: Optional[datetime] = None
    last_sync_categories: Optional[datetime] = None
    last_sync_stock: Optional[datetime] = None
    sync_interval_minutes: int = 15  # Intervalo de polling por defecto
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: Optional[datetime] = None

class PrestashopProduct(BaseModel):
    """Producto sincronizado desde PrestaShop"""
    id: str  # ID local
    account_id: str
    integration_id: str  # ID de la integración
    prestashop_id: int  # ID del producto en PrestaShop
    local_product_id: Optional[str] = None  # ID del producto local mapeado
    name: str
    sku: Optional[str] = None
    price: float
    stock_quantity: int
    category_id: Optional[int] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: Optional[datetime] = None

class PrestashopCategory(BaseModel):
    """Categoría sincronizada desde PrestaShop"""
    id: str  # ID local
    account_id: str
    integration_id: str
    prestashop_id: int
    name: str
    parent_id: Optional[int] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now())

class StockConflict(BaseModel):
    """Conflicto de stock entre local y PrestaShop"""
    id: str
    account_id: str
    product_id: str
    product_name: str
    sku: str
    local_stock: int
    prestashop_stock: int
    integration_id: str
    detected_at: datetime = Field(default_factory=lambda: datetime.now())
    resolved: bool = False
    resolution: Optional[str] = None  # 'local' o 'prestashop'
    resolved_at: Optional[datetime] = None

class SyncLog(BaseModel):
    """Log de sincronización"""
    id: str
    account_id: str
    integration_id: str
    sync_type: str  # 'products', 'categories', 'stock'
    status: str  # 'success', 'error', 'partial'
    message: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now())
