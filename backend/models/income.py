from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid

class OtherIncomeCreate(BaseModel):
    description: str
    amount: float

class OtherIncomeCreateWithDate(OtherIncomeCreate):
    custom_date: str  # Fecha personalizada en formato YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS

class OtherIncome(OtherIncomeCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    user_name: str
