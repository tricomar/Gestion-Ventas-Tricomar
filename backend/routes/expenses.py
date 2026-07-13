"""
Router para gestión de gastos
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt

from models.expenses import Expense, ExpenseCreate
from utils import db, get_current_user, require_admin
from models.users import User

router = APIRouter(prefix="/expenses", tags=["expenses"])

@router.post("/expenses", response_model=Expense)
async def create_expense(expense_input: ExpenseCreate, current_user: User = Depends(get_current_user)):
    expense_dict = expense_input.model_dump()
    expense_dict['user_id'] = current_user.id
    expense_dict['user_name'] = current_user.name
    expense = Expense(**expense_dict)
    
    doc = expense.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.expenses.insert_one(doc)
    
    return expense

@router.get("/expenses", response_model=List[Expense])
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

@router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_input: ExpenseCreate, current_user: User = Depends(get_current_user)):
    existing = await db.expenses.find_one({'id': expense_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Update expense data
    update_data = expense_input.model_dump()
    await db.expenses.update_one({'id': expense_id}, {'$set': update_data})
    
    # Fetch updated expense
    updated = await db.expenses.find_one({'id': expense_id}, {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    # Rebuild Expense object with existing user data
    updated['user_id'] = existing['user_id']
    updated['user_name'] = existing['user_name']
    
    return Expense(**updated)

@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    result = await db.expenses.delete_one({'id': expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted"}
