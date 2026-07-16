"""
Router para gestión de clientes CRM
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import bcrypt

from models.customers import Customer, CustomerBase, CustomerCreate, CustomerUpdate
from utils import db, get_current_user, require_admin
from models.users import User

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    """Obtener todos los clientes"""
    customers = await db.customers.find({}, {'_id': 0}).sort('name', 1).to_list(1000)
    
    result = []
    for customer in customers:
        # Convertir created_at si es string
        if isinstance(customer.get('created_at'), str):
            customer['created_at'] = datetime.fromisoformat(customer['created_at'])
        result.append(Customer(**customer))
    
    return result

@router.get("/search")
async def search_customers(q: str, current_user: User = Depends(get_current_user)):
    customers = await db.customers.find(
        {'name': {'$regex': q, '$options': 'i'}},
        {'_id': 0}
    ).sort('purchase_count', -1).limit(10).to_list(10)
    return customers

@router.post("", response_model=Customer)
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
