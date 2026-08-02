"""
Router para gestión de ventas
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import uuid
import bcrypt

from models.sales import Sale, SaleCreate, SaleCreateWithDate
from utils import db, get_current_user, require_admin
from models.users import User
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from utils.audit import create_audit_log

# Zona horaria de Chile
CHILE_TZ = ZoneInfo('America/Santiago')

router = APIRouter(prefix="/sales", tags=["sales"])

@router.post("", response_model=Sale)
async def create_sale(sale_input: SaleCreate, current_user: User = Depends(get_current_user)):
    # Create sale with user-provided total
    sale_dict = sale_input.model_dump()
    sale_dict['user_id'] = current_user.id
    sale_dict['user_name'] = current_user.name
    sale = Sale(**sale_dict)
    
    # Save to database
    doc = sale.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    # Agregar account_id (tenant isolation)
    doc = add_account_id_to_document(current_user.dict(), doc)
    
    # Guardar fecha en zona horaria de Chile (YYYY-MM-DD)
    chile_time = datetime.now(CHILE_TZ)
    doc['date'] = chile_time.strftime('%Y-%m-%d')
    
    await db.sales.insert_one(doc)
    
    # Update product usage count (con filtro de tenant)
    tenant_filter = get_tenant_filter(current_user.dict(), {'id': sale_input.product_id})
    await db.products.update_one(
        tenant_filter,
        {'$inc': {'usage_count': 1}},
        upsert=False
    )
    
    # Update customer stats if customer_id provided
    if sale_input.customer_id:
        sale_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        tenant_filter = get_tenant_filter(current_user.dict(), {'id': sale_input.customer_id})
        await db.customers.update_one(
            tenant_filter,
            {
                '$inc': {
                    'purchase_count': 1,
                    'total_spent': sale_input.total
                },
                '$set': {
                    'last_purchase_date': sale_date
                }
            }
        )
    
    return sale

@router.post("/past", response_model=Sale)
async def create_past_sale(
    sale_input: SaleCreateWithDate, 
    current_user: User = Depends(get_current_user)
):
    """
    Crear venta con fecha personalizada (pasada)
    Solo disponible para admin y supervisor
    """
    # Validar permisos
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores y supervisores pueden registrar ventas pasadas"
        )
    
    # Validar y parsear fecha personalizada en zona horaria de Chile
    try:
        if 'T' in sale_input.custom_date:
            # Tiene hora especificada
            custom_datetime = datetime.fromisoformat(sale_input.custom_date.replace('Z', ''))
            # Asignar timezone de Chile si no tiene
            if custom_datetime.tzinfo is None:
                custom_datetime = custom_datetime.replace(tzinfo=CHILE_TZ)
        else:
            # Solo fecha (YYYY-MM-DD), usar hora actual de Chile
            date_part = datetime.fromisoformat(sale_input.custom_date)
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
    
    # Validar que la fecha no sea futura (comparar en zona horaria de Chile)
    now_chile = datetime.now(CHILE_TZ)
    if custom_datetime > now_chile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede registrar una venta con fecha futura"
        )
    
    # Convertir a UTC para guardar
    custom_datetime_utc = custom_datetime.astimezone(timezone.utc)
    
    # Crear venta con la fecha personalizada
    sale_dict = sale_input.model_dump(exclude={'custom_date'})
    sale_dict['user_id'] = current_user.id
    sale_dict['user_name'] = current_user.name
    sale_dict['created_at'] = custom_datetime_utc
    # Guardar fecha en formato YYYY-MM-DD en zona horaria de Chile
    sale_dict['date'] = custom_datetime.strftime('%Y-%m-%d')
    
    sale = Sale(**sale_dict)
    
    # Save to database
    doc = sale.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sales.insert_one(doc)
    
    # Update product usage count
    await db.products.update_one(
        {'id': sale_input.product_id},
        {'$inc': {'usage_count': 1}},
        upsert=False
    )
    
    # Update customer stats if customer_id provided
    if sale_input.customer_id:
        sale_date = custom_datetime.strftime('%Y-%m-%d')
        await db.customers.update_one(
            {'id': sale_input.customer_id},
            {
                '$inc': {
                    'purchase_count': 1,
                    'total_spent': sale_input.total
                },
                '$set': {
                    'last_purchase_date': sale_date
                }
            }
        )
    
    return sale

@router.get("", response_model=List[Sale])
async def get_sales(date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict())
    
    if date:
        # Simplemente filtrar por el campo 'date' que se guarda como 'YYYY-MM-DD'
        tenant_filter['date'] = date
    
    sales = await db.sales.find(tenant_filter, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for sale in sales:
        if isinstance(sale.get('created_at'), str):
            sale['created_at'] = datetime.fromisoformat(sale['created_at'])
        
        # Handle legacy documents that have 'product' instead of 'product_name'
        if 'product' in sale and not sale.get('product_name'):
            sale['product_name'] = sale['product']
        
        # Set defaults for missing fields
        if 'product_id' not in sale:
            sale['product_id'] = ''
        if 'cost_price' not in sale:
            sale['cost_price'] = 0
        if 'store' not in sale:
            sale['store'] = 'A'
        if 'has_tax' not in sale:
            sale['has_tax'] = True
        if 'payment_method' not in sale:
            sale['payment_method'] = 'Efectivo'
        if 'quantity' not in sale:
            sale['quantity'] = 1
        if 'price' not in sale:
            sale['price'] = sale.get('total', 0)
        if 'total' not in sale:
            sale['total'] = 0
        
        result.append(Sale(**sale))
    
    return result

@router.put("/{sale_id}", response_model=Sale)
async def update_sale(sale_id: str, sale_input: SaleCreate, current_user: User = Depends(get_current_user)):
    # Validar permisos: solo account_admin y supervisor pueden editar
    if current_user.role not in ['account_admin', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar registros de ventas"
        )
    
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict(), {'id': sale_id})
    
    existing = await db.sales.find_one(tenant_filter, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    # Guardar datos antiguos para auditoría
    old_data = {
        "product_name": existing.get('product_name'),
        "quantity": existing.get('quantity'),
        "price": existing.get('price'),
        "total": existing.get('total'),
        "payment_method": existing.get('payment_method')
    }
    
    # Update sale data (sin modificar created_at ni date)
    update_data = sale_input.model_dump()
    await db.sales.update_one(tenant_filter, {'$set': update_data})
    
    # Guardar datos nuevos para auditoría
    new_data = {
        "product_name": update_data.get('product_name'),
        "quantity": update_data.get('quantity'),
        "price": update_data.get('price'),
        "total": update_data.get('total'),
        "payment_method": update_data.get('payment_method')
    }
    
    # Crear log de auditoría
    await create_audit_log(
        account_id=current_user.account_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action="update",
        record_type="sale",
        record_id=sale_id,
        old_data=old_data,
        new_data=new_data
    )
    
    # Fetch updated sale
    updated = await db.sales.find_one(tenant_filter, {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    # Rebuild Sale object with existing user data
    updated['user_id'] = existing['user_id']
    updated['user_name'] = existing['user_name']
    
    return Sale(**updated)

@router.delete("/{sale_id}")
async def delete_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    # Validar permisos: solo account_admin y supervisor pueden eliminar
    if current_user.role not in ['account_admin', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar registros de ventas"
        )
    
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict(), {'id': sale_id})
    
    # Obtener datos antes de eliminar para auditoría
    existing = await db.sales.find_one(tenant_filter, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    old_data = {
        "product_name": existing.get('product_name'),
        "quantity": existing.get('quantity'),
        "price": existing.get('price'),
        "total": existing.get('total'),
        "payment_method": existing.get('payment_method'),
        "date": existing.get('date')
    }
    
    result = await db.sales.delete_one(tenant_filter)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    # Crear log de auditoría
    await create_audit_log(
        account_id=current_user.account_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action="delete",
        record_type="sale",
        record_id=sale_id,
        old_data=old_data,
        new_data=None
    )
    
    return {"message": "Venta eliminada"}
