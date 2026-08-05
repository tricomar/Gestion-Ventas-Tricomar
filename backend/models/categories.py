"""
Modelo para categorías de productos con estructura jerárquica
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class Category(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None  # None para categorías raíz
    level: int = 0  # 0-3 para 4 niveles máximo
    account_id: str  # Para multi-tenancy
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: str
