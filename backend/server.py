from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============= MODELS =============

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "operator"  # admin or operator

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    user: User

# Product Models
class ProductBase(BaseModel):
    name: str
    last_price: Optional[float] = None

class Product(ProductBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usage_count: int = 0

# Customer Models
class CustomerBase(BaseModel):
    name: str

class Customer(CustomerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    purchase_count: int = 0

# Sale Models
class SaleCreate(BaseModel):
    product: str
    quantity: float
    price: float
    customer: Optional[str] = None
    payment_method: str  # Efectivo, Tarjeta, Transferencia

class Sale(SaleCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    user_name: str

# Expense Models
class ExpenseCreate(BaseModel):
    description: str
    amount: float

class Expense(ExpenseCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    user_name: str

# Other Income Models
class OtherIncomeCreate(BaseModel):
    description: str
    amount: float

class OtherIncome(OtherIncomeCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    user_name: str

# Dashboard Stats Models
class DashboardStats(BaseModel):
    today_sales: float
    today_expenses: float
    today_other_income: float
    today_net: float
    monthly_sales: float
    monthly_expenses: float
    monthly_net: float
    sales_by_payment_method: Dict[str, float]
    top_products: List[Dict[str, Any]]
    daily_sales_trend: List[Dict[str, Any]]

# ============= AUTH HELPERS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============= AUTH ROUTES =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_input: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({'email': user_input.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_input.model_dump(exclude={'password'})
    user = User(**user_dict)
    
    # Hash password and store
    doc = user.model_dump()
    doc['password_hash'] = hash_password(user_input.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Generate token
    token = create_token(user.id, user.email)
    
    return TokenResponse(token=token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password_hash'})
    token = create_token(user.id, user.email)
    
    return TokenResponse(token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ============= PRODUCT ROUTES =============

@api_router.get("/products/search")
async def search_products(q: str, current_user: User = Depends(get_current_user)):
    products = await db.products.find(
        {'name': {'$regex': q, '$options': 'i'}},
        {'_id': 0}
    ).sort('usage_count', -1).limit(10).to_list(10)
    return products

@api_router.post("/products", response_model=Product)
async def create_or_get_product(product_input: ProductBase, current_user: User = Depends(get_current_user)):
    # Check if product exists
    existing = await db.products.find_one({'name': product_input.name}, {'_id': 0})
    if existing:
        if isinstance(existing.get('created_at'), str):
            existing['created_at'] = datetime.fromisoformat(existing['created_at'])
        return Product(**existing)
    
    # Create new product
    product = Product(**product_input.model_dump())
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    
    return product

# ============= CUSTOMER ROUTES =============

@api_router.get("/customers/search")
async def search_customers(q: str, current_user: User = Depends(get_current_user)):
    customers = await db.customers.find(
        {'name': {'$regex': q, '$options': 'i'}},
        {'_id': 0}
    ).sort('purchase_count', -1).limit(10).to_list(10)
    return customers

@api_router.post("/customers", response_model=Customer)
async def create_or_get_customer(customer_input: CustomerBase, current_user: User = Depends(get_current_user)):
    # Check if customer exists
    existing = await db.customers.find_one({'name': customer_input.name}, {'_id': 0})
    if existing:
        if isinstance(existing.get('created_at'), str):
            existing['created_at'] = datetime.fromisoformat(existing['created_at'])
        return Customer(**existing)
    
    # Create new customer
    customer = Customer(**customer_input.model_dump())
    doc = customer.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.customers.insert_one(doc)
    
    return customer

# ============= SALE ROUTES =============

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_input: SaleCreate, current_user: User = Depends(get_current_user)):
    # Calculate total
    total = sale_input.quantity * sale_input.price
    
    # Create sale
    sale_dict = sale_input.model_dump()
    sale_dict['total'] = total
    sale_dict['user_id'] = current_user.id
    sale_dict['user_name'] = current_user.name
    sale = Sale(**sale_dict)
    
    # Save to database
    doc = sale.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sales.insert_one(doc)
    
    # Update product usage count and last price
    await db.products.update_one(
        {'name': sale_input.product},
        {'$inc': {'usage_count': 1}, '$set': {'last_price': sale_input.price}},
        upsert=True
    )
    
    # Update customer purchase count if provided
    if sale_input.customer:
        await db.customers.update_one(
            {'name': sale_input.customer},
            {'$inc': {'purchase_count': 1}},
            upsert=True
        )
    
    return sale

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if date:
        # Parse date and get start/end of day
        target_date = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = target_date + timedelta(days=1)
        query['created_at'] = {
            '$gte': target_date.isoformat(),
            '$lt': next_day.isoformat()
        }
    
    sales = await db.sales.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for sale in sales:
        if isinstance(sale.get('created_at'), str):
            sale['created_at'] = datetime.fromisoformat(sale['created_at'])
    
    return sales

@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    result = await db.sales.delete_one({'id': sale_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    return {"message": "Sale deleted"}

# ============= EXPENSE ROUTES =============

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_input: ExpenseCreate, current_user: User = Depends(get_current_user)):
    expense_dict = expense_input.model_dump()
    expense_dict['user_id'] = current_user.id
    expense_dict['user_name'] = current_user.name
    expense = Expense(**expense_dict)
    
    doc = expense.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.expenses.insert_one(doc)
    
    return expense

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if date:
        target_date = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = target_date + timedelta(days=1)
        query['created_at'] = {
            '$gte': target_date.isoformat(),
            '$lt': next_day.isoformat()
        }
    
    expenses = await db.expenses.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for expense in expenses:
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    
    return expenses

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    result = await db.expenses.delete_one({'id': expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted"}

# ============= OTHER INCOME ROUTES =============

@api_router.post("/other-income", response_model=OtherIncome)
async def create_other_income(income_input: OtherIncomeCreate, current_user: User = Depends(get_current_user)):
    income_dict = income_input.model_dump()
    income_dict['user_id'] = current_user.id
    income_dict['user_name'] = current_user.name
    income = OtherIncome(**income_dict)
    
    doc = income.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.other_income.insert_one(doc)
    
    return income

@api_router.get("/other-income", response_model=List[OtherIncome])
async def get_other_income(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if date:
        target_date = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = target_date + timedelta(days=1)
        query['created_at'] = {
            '$gte': target_date.isoformat(),
            '$lt': next_day.isoformat()
        }
    
    income_list = await db.other_income.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for income in income_list:
        if isinstance(income.get('created_at'), str):
            income['created_at'] = datetime.fromisoformat(income['created_at'])
    
    return income_list

@api_router.delete("/other-income/{income_id}")
async def delete_other_income(income_id: str, current_user: User = Depends(get_current_user)):
    result = await db.other_income.delete_one({'id': income_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income not found")
    return {"message": "Income deleted"}

# ============= DASHBOARD ROUTES =============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)
    
    # Today's stats
    today_sales_docs = await db.sales.find({
        'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
    }, {'_id': 0}).to_list(10000)
    today_sales = sum(sale['total'] for sale in today_sales_docs)
    
    today_expenses_docs = await db.expenses.find({
        'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
    }, {'_id': 0}).to_list(10000)
    today_expenses = sum(exp['amount'] for exp in today_expenses_docs)
    
    today_income_docs = await db.other_income.find({
        'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
    }, {'_id': 0}).to_list(10000)
    today_other_income = sum(inc['amount'] for inc in today_income_docs)
    
    # Monthly stats
    monthly_sales_docs = await db.sales.find({
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    monthly_sales = sum(sale['total'] for sale in monthly_sales_docs)
    
    monthly_expenses_docs = await db.expenses.find({
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    monthly_expenses = sum(exp['amount'] for exp in monthly_expenses_docs)
    
    monthly_income_docs = await db.other_income.find({
        'created_at': {'$gte': month_start.isoformat(), '$lt': next_month_start.isoformat()}
    }, {'_id': 0}).to_list(100000)
    monthly_other_income = sum(inc['amount'] for inc in monthly_income_docs)
    
    # Sales by payment method
    payment_methods = {}
    for sale in today_sales_docs:
        method = sale['payment_method']
        payment_methods[method] = payment_methods.get(method, 0) + sale['total']
    
    # Top products (this month)
    product_totals = {}
    for sale in monthly_sales_docs:
        product = sale['product']
        product_totals[product] = product_totals.get(product, 0) + sale['total']
    
    top_products = [
        {'product': k, 'total': v}
        for k, v in sorted(product_totals.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    # Daily sales trend (last 7 days)
    daily_trend = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_sales_docs = await db.sales.find({
            'created_at': {'$gte': day_start.isoformat(), '$lt': day_end.isoformat()}
        }, {'_id': 0}).to_list(10000)
        day_total = sum(sale['total'] for sale in day_sales_docs)
        daily_trend.append({
            'date': day_start.strftime('%Y-%m-%d'),
            'total': day_total
        })
    
    return DashboardStats(
        today_sales=today_sales,
        today_expenses=today_expenses,
        today_other_income=today_other_income,
        today_net=today_sales + today_other_income - today_expenses,
        monthly_sales=monthly_sales,
        monthly_expenses=monthly_expenses,
        monthly_net=monthly_sales + monthly_other_income - monthly_expenses,
        sales_by_payment_method=payment_methods,
        top_products=top_products,
        daily_sales_trend=daily_trend
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
