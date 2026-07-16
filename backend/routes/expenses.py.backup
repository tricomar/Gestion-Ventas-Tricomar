"""
Router para gestión de gastos
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import uuid
import bcrypt

from models.expenses import Expense, ExpenseCreate, ExpenseCreateWithDate
from utils import db, get_current_user, require_admin
from models.users import User

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

router = APIRouter(prefix="/expenses", tags=["expenses"])

@router.post("", response_model=Expense)
async def create_expense(expense_input: ExpenseCreate, current_user: User = Depends(get_current_user)):
    expense_dict = expense_input.model_dump()
    expense_dict['user_id'] = current_user.id
    expense_dict['user_name'] = current_user.name
    expense = Expense(**expense_dict)
    
    doc = expense.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.expenses.insert_one(doc)
    
    return expense

@router.get("", response_model=List[Expense])
async def get_expenses(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
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
    
    expenses = await db.expenses.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for expense in expenses:
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    
    return expenses

@router.put("/{expense_id}", response_model=Expense)
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

@router.delete("/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    result = await db.expenses.delete_one({'id': expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted"}


@router.post("/past", response_model=Expense)
async def create_past_expense(
    expense_input: ExpenseCreateWithDate,
    current_user: User = Depends(get_current_user)
):
    """
    Crear egreso con fecha personalizada (pasada)
    Solo disponible para admin y supervisor
    """
    # Validar permisos
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores y supervisores pueden registrar egresos pasados"
        )
    
    # Validar y parsear fecha personalizada en zona horaria de Chile
    try:
        if 'T' in expense_input.custom_date:
            # Tiene hora especificada
            custom_datetime = datetime.fromisoformat(expense_input.custom_date.replace('Z', ''))
            # Asignar timezone de Chile si no tiene
            if custom_datetime.tzinfo is None:
                custom_datetime = custom_datetime.replace(tzinfo=CHILE_TZ)
        else:
            # Solo fecha (YYYY-MM-DD), usar hora actual de Chile
            date_part = datetime.fromisoformat(expense_input.custom_date)
            current_time_chile = datetime.now(CHILE_TZ)
            custom_datetime = date_part.replace(
                hour=current_time_chile.hour,
                minute=current_time_chile.minute,
                second=current_time_chile.second,
                tzinfo=CHILE_TZ
            )
            
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de fecha inválido. Use YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS"
        )
    
    # Validar que la fecha no sea futura
    now_chile = datetime.now(CHILE_TZ)
    if custom_datetime > now_chile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede registrar un egreso con fecha futura"
        )
    
    # Convertir a UTC para guardar
    custom_datetime_utc = custom_datetime.astimezone(timezone.utc)
    
    # Crear egreso con la fecha personalizada
    expense_dict = expense_input.model_dump(exclude={'custom_date'})
    expense_dict['user_id'] = current_user.id
    expense_dict['user_name'] = current_user.name
    expense_dict['created_at'] = custom_datetime_utc
    
    expense = Expense(**expense_dict)
    
    # Save to database
    doc = expense.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.expenses.insert_one(doc)
    
    return expense
