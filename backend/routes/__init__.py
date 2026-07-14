"""
Sistema de routers modulares
Importa y combina todos los routers en un APIRouter principal
"""

from fastapi import APIRouter

from .auth import router as auth_router
from .users import router as users_router
from .products import router as products_router
from .sales import router as sales_router
from .expenses import router as expenses_router
from .income import router as income_router
from .customers import router as customers_router
from .notes import router as notes_router
from .settings import router as settings_router
from .dashboard import router as dashboard_router
from .database import router as database_router
from .sales_records import router as sales_records_router
from .indicators import router as indicators_router

# Crear el router principal con prefijo /api
api_router = APIRouter(prefix="/api")

# Incluir todos los routers
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(products_router)
api_router.include_router(sales_router)
api_router.include_router(expenses_router)
api_router.include_router(income_router)
api_router.include_router(customers_router)
api_router.include_router(notes_router)
api_router.include_router(settings_router)
api_router.include_router(dashboard_router)
api_router.include_router(database_router)
api_router.include_router(sales_records_router)
api_router.include_router(indicators_router)

__all__ = ["api_router"]
