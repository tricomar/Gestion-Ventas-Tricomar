"""
Modelos Pydantic para la aplicación de Gestión de Ventas
"""

from .users import User, UserBase, UserCreate, UserUpdate, UserLogin, TokenResponse
from .products import Product, ProductBase, ProductCreate
from .sales import Sale, SaleCreate
from .expenses import Expense, ExpenseCreate
from .income import OtherIncome, OtherIncomeCreate
from .customers import Customer, CustomerBase, CustomerCreate, CustomerUpdate
from .notes import Note, NoteBase, NoteCreate, NoteUpdate, NoteRead
from .settings import Settings, SettingsUpdate
from .dashboard import RealtimeMetrics, DashboardStats

__all__ = [
    # Users
    "User", "UserBase", "UserCreate", "UserUpdate", "UserLogin", "TokenResponse",
    # Products
    "Product", "ProductBase", "ProductCreate",
    # Sales
    "Sale", "SaleCreate",
    # Expenses
    "Expense", "ExpenseCreate",
    # Income
    "OtherIncome", "OtherIncomeCreate",
    # Customers
    "Customer", "CustomerBase", "CustomerCreate", "CustomerUpdate",
    # Notes
    "Note", "NoteBase", "NoteCreate", "NoteUpdate", "NoteRead",
    # Settings
    "Settings", "SettingsUpdate",
    # Dashboard
    "RealtimeMetrics", "DashboardStats",
]
