from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime, timezone
from typing import Optional
import uuid

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "empleado"  # admin, sub_admin, supervisor, empleado

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: User
