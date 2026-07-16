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
        # Parse date in Chile timezone
        # date viene como 'YYYY-MM-DD' (ejemplo: '2026-07-15')
        # Necesitamos buscar todas las ventas de ese día en hora Chile
        
        # Crear inicio y fin del día en zona horaria de Chile
        target_date = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0)
        chile_start = target_date.replace(tzinfo=CHILE_TZ)
        chile_end = chile_start + timedelta(days=1)
        
        # Convertir a UTC para la query
        utc_start = chile_start.astimezone(timezone.utc)
        utc_end = chile_end.astimezone(timezone.utc)
        
        tenant_filter['created_at'] = {
            '$gte': utc_start.isoformat(),
            '$lt': utc_end.isoformat()
        }
    
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
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict(), {'id': sale_id})
    
    existing = await db.sales.find_one(tenant_filter, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    # Update sale data
    update_data = sale_input.model_dump()
    await db.sales.update_one(tenant_filter, {'$set': update_data})
    
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
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict(), {'id': sale_id})
    
    result = await db.sales.delete_one(tenant_filter)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return {"message": "Venta eliminada"}
