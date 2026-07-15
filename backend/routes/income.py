"""
Router para gestión de otros ingresos
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import uuid
import bcrypt

from models.income import OtherIncome, OtherIncomeCreate
from utils import db, get_current_user, require_admin
from models.users import User

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

router = APIRouter(prefix="/other-income", tags=["income"])

@router.post("", response_model=OtherIncome)
async def create_other_income(income_input: OtherIncomeCreate, current_user: User = Depends(get_current_user)):
    income_dict = income_input.model_dump()
    income_dict['user_id'] = current_user.id
    income_dict['user_name'] = current_user.name
    income = OtherIncome(**income_dict)
    
    doc = income.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.other_income.insert_one(doc)
    
    return income

@router.get("", response_model=List[OtherIncome])
async def get_other_income(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if date:
        # Parse date in Chile timezone
        target_date = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        chile_start = target_date.replace(tzinfo=CHILE_TZ)
        chile_end = chile_start + timedelta(days=1)
        
        # Convertir a UTC para la query
        utc_start = chile_start.astimezone(timezone.utc)
        utc_end = chile_end.astimezone(timezone.utc)
        
        query['created_at'] = {
            '$gte': utc_start.isoformat(),
            '$lt': utc_end.isoformat()
        }
    
    income_list = await db.other_income.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for income in income_list:
        if isinstance(income.get('created_at'), str):
            income['created_at'] = datetime.fromisoformat(income['created_at'])
    
    return income_list

@router.put("/{income_id}", response_model=OtherIncome)
async def update_other_income(income_id: str, income_input: OtherIncomeCreate, current_user: User = Depends(get_current_user)):
    existing = await db.other_income.find_one({'id': income_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Income not found")
    
    # Update income data
    update_data = income_input.model_dump()
    await db.other_income.update_one({'id': income_id}, {'$set': update_data})
    
    # Fetch updated income
    updated = await db.other_income.find_one({'id': income_id}, {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    # Rebuild OtherIncome object with existing user data
    updated['user_id'] = existing['user_id']
    updated['user_name'] = existing['user_name']
    
    return OtherIncome(**updated)

@router.delete("/{income_id}")
async def delete_other_income(income_id: str, current_user: User = Depends(get_current_user)):
    result = await db.other_income.delete_one({'id': income_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income not found")
    return {"message": "Income deleted"}
