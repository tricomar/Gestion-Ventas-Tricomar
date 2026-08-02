from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid

class AuditLog(BaseModel):
    """
    Modelo de log de auditoría para rastrear cambios en registros
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str  # Para multi-tenancy
    user_id: str
    user_name: str
    action: str  # "create", "update", "delete"
    record_type: str  # "sale", "expense", "income", "product", etc.
    record_id: str
    old_data: Optional[Dict[str, Any]] = None  # Datos antes del cambio
    new_data: Optional[Dict[str, Any]] = None  # Datos después del cambio
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogCreate(BaseModel):
    account_id: str
    user_id: str
    user_name: str
    action: str
    record_type: str
    record_id: str
    old_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
