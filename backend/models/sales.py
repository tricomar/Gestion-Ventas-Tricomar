from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional
import uuid

class SaleCreate(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    price: float
    total: float  # Now editable by user
    cost_price: float
    store: str  # A or B
    has_tax: bool = True  # Default activated
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    payment_method: str  # Efectivo, Tarjeta, Transferencia

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    user_name: str
    # Core fields (with defaults for legacy documents)
    product_id: str = ""
    product_name: str = ""
    quantity: float = 0
    price: float = 0
    total: float = 0
    cost_price: float = 0
    store: str = "A"
    has_tax: bool = True
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    payment_method: str = "Efectivo"
    # Legacy field support
    product: Optional[str] = None
    customer: Optional[str] = None  # Legacy field
