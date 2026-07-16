"""
Modelos para sistema multi-tenant de cuentas
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Store(BaseModel):
    """Tienda dentro de una cuenta"""
    id: str
    name: str
    code: str  # A, B, C, etc.

class Account(BaseModel):
    """Cuenta/Tenant en el sistema multi-tenant"""
    id: str
    owner_user_id: str
    business_name: str
    plan: str = "free"  # free, premium, enterprise
    max_stores: int = 1
    max_employees: int = 0
    current_employees: int = 0
    stores: List[Store] = []
    enabled_modules: List[str] = ["sales"]  # Módulos habilitados
    status: str = "active"  # active, suspended, cancelled
    created_at: str
    updated_at: str

class UpdateAccountRequest(BaseModel):
    """Request para actualizar configuración de cuenta"""
    plan: Optional[str] = None
    max_stores: Optional[int] = None
    max_employees: Optional[int] = None
    enabled_modules: Optional[List[str]] = None
    status: Optional[str] = None

class AddStoreRequest(BaseModel):
    """Request para agregar una tienda a una cuenta"""
    name: str
    code: str

class UpdateStoreRequest(BaseModel):
    """Request para actualizar una tienda"""
    name: str

# Constantes de módulos disponibles
AVAILABLE_MODULES = {
    "sales": "Ventas",
    "inventory": "Inventario",
    "expenses": "Egresos",
    "income": "Otros Ingresos",
    "customers": "CRM Clientes",
    "notes": "Notas y Calendario",
    "reports": "Registros Históricos",
    "indicators": "Indicadores Económicos"
}

# Planes disponibles
PLANS = {
    "free": {
        "name": "Gratuito",
        "default_modules": ["sales"],
        "default_max_stores": 1,
        "default_max_employees": 0
    },
    "premium": {
        "name": "Premium",
        "default_modules": ["sales", "inventory", "expenses", "income", "customers", "indicators"],
        "default_max_stores": 3,
        "default_max_employees": 5
    },
    "enterprise": {
        "name": "Enterprise",
        "default_modules": list(AVAILABLE_MODULES.keys()),
        "default_max_stores": 999,
        "default_max_employees": 999
    }
}
