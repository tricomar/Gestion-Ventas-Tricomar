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
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from utils import db, get_current_user, require_admin
from models.users import User
from utils.audit import create_audit_log

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
    # Agregar account_id (tenant isolation)
    doc = add_account_id_to_document(current_user.dict(), doc)

    await db.expenses.insert_one(doc)
    
    return expense

@router.get("", response_model=List[Expense])
async def get_expenses(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    # CRITICAL: Filtro de tenant para multi-tenancy
    tenant_filter = get_tenant_filter(current_user.dict())
    
    if date:
        # Filtrar por el campo 'date' que se guarda como 'YYYY-MM-DD'
        tenant_filter['date'] = date
    
    expenses = await db.expenses.find(tenant_filter, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for expense in expenses:
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    
    return expenses

@router.put("/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_input: ExpenseCreate, current_user: User = Depends(get_current_user)):
    # Validar permisos: solo account_admin y supervisor pueden editar
    if current_user.role not in ['account_admin', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar registros de egresos"
        )
    
    existing = await db.expenses.find_one(get_tenant_filter(current_user.dict(), {'id': expense_id}), {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Guardar datos antiguos para auditoría
    old_data = {
        "description": existing.get('description'),
        "amount": existing.get('amount'),
        "category": existing.get('category'),
        "payment_method": existing.get('payment_method')
    }
    
    # Update expense data (sin modificar created_at ni date)
    update_data = expense_input.model_dump()
    await db.expenses.update_one(get_tenant_filter(current_user.dict(), {'id': expense_id}), {'$set': update_data})
    
    # Guardar datos nuevos para auditoría
    new_data = {
        "description": update_data.get('description'),
        "amount": update_data.get('amount'),
        "category": update_data.get('category'),
        "payment_method": update_data.get('payment_method')
    }
    
    # Crear log de auditoría
    await create_audit_log(
        account_id=current_user.account_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action="update",
        record_type="expense",
        record_id=expense_id,
        old_data=old_data,
        new_data=new_data
    )
    
    # Fetch updated expense
    updated = await db.expenses.find_one(get_tenant_filter(current_user.dict(), {'id': expense_id}), {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    # Rebuild Expense object with existing user data
    updated['user_id'] = existing['user_id']
    updated['user_name'] = existing['user_name']
    
    return Expense(**updated)

@router.delete("/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    # Validar permisos: solo account_admin y supervisor pueden eliminar
    if current_user.role not in ['account_admin', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar registros de egresos"
        )
    
    # Obtener datos antes de eliminar para auditoría
    existing = await db.expenses.find_one(get_tenant_filter(current_user.dict(), {'id': expense_id}), {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    old_data = {
        "description": existing.get('description'),
        "amount": existing.get('amount'),
        "category": existing.get('category'),
        "payment_method": existing.get('payment_method'),
        "date": existing.get('date')
    }
    
    result = await db.expenses.delete_one(get_tenant_filter(current_user.dict(), {'id': expense_id}))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Crear log de auditoría
    await create_audit_log(
        account_id=current_user.account_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action="delete",
        record_type="expense",
        record_id=expense_id,
        old_data=old_data,
        new_data=None
    )
    
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
    # Agregar account_id (tenant isolation)
    doc = add_account_id_to_document(current_user.dict(), doc)

    await db.expenses.insert_one(doc)
    
    return expense
