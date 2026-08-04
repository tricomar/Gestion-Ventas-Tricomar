from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import List, Optional

class SettingsUpdate(BaseModel):
    store_a_name: str = "Tienda A"
    store_b_name: str = "Tienda B"
    product_categories: List[str] = Field(default_factory=lambda: [
        "Alimentos",
        "Accesorios",
        "Medicinas",
        "Higiene",
        "Juguetes",
        "Otros"
    ])
    session_duration_hours: int = Field(default=168, ge=1)  # Default: 1 semana (168 horas)
    company_logo: Optional[str] = None  # Base64 o URL del logo
    company_name: Optional[str] = "Negocio Feliz"  # Nombre de la empresa

class Settings(SettingsUpdate):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
