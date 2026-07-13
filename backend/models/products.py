from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional
import uuid

class ProductBase(BaseModel):
    name: str
    store: str = "A"  # Default A
    cost_price: float = 0
    sale_price: float = 0

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
