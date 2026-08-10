from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime, timezone
from typing import Optional
import uuid

class ProductBase(BaseModel):
    name: str
    store: str = "A"  # Default A
    cost_price: Optional[float] = 0  # Opcional - sin esto no se puede calcular utilidad
    sale_price: float = 0
    sku: Optional[str] = None
    brand: Optional[str] = None  # Marca del producto
    barcode: Optional[str] = None  # Código de barra
    expiry_date: Optional[str] = None  # Fecha de vencimiento (YYYY-MM-DD) - Opcional, para WooCommerce/Shopify
    category: Optional[str] = None
    stock: Optional[int] = 0  # Stock disponible
    ecommerce_active: Optional[bool] = None  # Estado de publicación en ecommerce (PrestaShop/WooCommerce)
    prestashop_id: Optional[int] = None  # ID del producto en PrestaShop
    prestashop_integration_id: Optional[str] = None  # ID de integración para limpieza
    store_id: Optional[str] = None  # ID de tienda para filtrado multi-tenant
    
    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v):
        if v and len(v) > 15:
            raise ValueError('SKU no puede tener más de 15 caracteres')
        return v

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usage_count: int = 0
    last_price: Optional[float] = None
    
    @property
    def tax_amount(self) -> float:
        """19% IVA in Chile"""
        if self.sale_price == 0:
            return 0
        return self.sale_price - (self.sale_price / 1.19)
    
    @property
    def profit(self) -> float:
        """Profit without tax"""
        if self.sale_price == 0:
            return 0
        return (self.sale_price / 1.19) - self.cost_price
