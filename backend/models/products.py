from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import uuid

class ProductCombination(BaseModel):
    """Combinación/Variante de producto (tallas, colores, etc.)"""
    id: int
    reference: Optional[str] = None
    ean13: Optional[str] = None
    quantity: int = 0
    price: int = 0  # Precio como entero
    attributes: List[Dict[str, Any]] = []  # [{"name": "Talla", "value": "M"}, {"name": "Color", "value": "Rojo"}]

class ProductBase(BaseModel):
    name: str
    store: str = "A"  # Default A
    cost_price: Optional[int] = 0  # Precio como entero
    sale_price: int = 0  # Precio como entero
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
    
    # Nuevos campos para sincronización completa
    image_url: Optional[str] = None  # URL de imagen principal
    summary: Optional[str] = None  # Descripción corta (resumen)
    description: Optional[str] = None  # Descripción larga
    weight: Optional[float] = None  # Peso en kg
    combinations: Optional[List[ProductCombination]] = []  # Combinaciones/variantes
    
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
    last_price: Optional[int] = None  # Precio como entero
    
    @property
    def tax_amount(self) -> int:
        """19% IVA in Chile - retorna entero"""
        if self.sale_price == 0:
            return 0
        return int(self.sale_price - (self.sale_price / 1.19))
    
    @property
    def profit(self) -> int:
        """Profit without tax - retorna entero"""
        if self.sale_price == 0:
            return 0
        return int((self.sale_price / 1.19) - self.cost_price)
