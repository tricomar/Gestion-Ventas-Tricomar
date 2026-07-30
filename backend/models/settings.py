from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import List

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

class Settings(SettingsUpdate):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
