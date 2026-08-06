from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional
import uuid

class CustomerBase(BaseModel):
    name: str  # Nombre/Razón Social
    customer_type: str = "Persona"  # Persona, Empresa
    rut: Optional[str] = None  # RUT formato chileno
    sin_rut: bool = False  # Checkbox para habilitar/deshabilitar RUT
    nombre_fantasia: Optional[str] = None  # Solo para Empresa
    giro: Optional[str] = None  # Solo para Empresa
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None  # Legacy field
    store: str = "A"  # A, B, or "Ambas"

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    customer_type: Optional[str] = None
    rut: Optional[str] = None
    sin_rut: Optional[bool] = None
    nombre_fantasia: Optional[str] = None
    giro: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    store: Optional[str] = None

class Customer(CustomerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total_spent: float = 0
    purchase_count: int = 0
    last_purchase_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
