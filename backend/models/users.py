from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime, timezone
from typing import Optional
import uuid

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "employee"  # super_admin, account_admin, employee

class UserCreate(UserBase):
    password: str
    account_id: Optional[str] = None
    business_name: Optional[str] = None  # Para crear cuenta nueva en registro

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: Optional[str] = None
    is_account_owner: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class UserLogin(BaseModel):
    email: str  # Puede ser "admin" o un email completo
    password: str

class TokenResponse(BaseModel):
    token: str
    user: User
