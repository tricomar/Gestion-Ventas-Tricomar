from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone

class SettingsUpdate(BaseModel):
    store_a_name: str = "Tienda A"
    store_b_name: str = "Tienda B"

class Settings(SettingsUpdate):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
