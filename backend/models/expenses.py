from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str  # compra_inventario, retiros, compras_informales, otros

class Expense(ExpenseCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    user_name: str
