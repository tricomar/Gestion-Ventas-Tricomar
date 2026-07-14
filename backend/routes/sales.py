"""
Router para gestión de ventas
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt

from models.sales import Sale, SaleCreate, SaleCreateWithDate
from utils import db, get_current_user, require_admin
from models.users import User

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
    doc['date'] = doc['created_at']  # Usar created_at como fecha de la venta
    await db.sales.insert_one(doc)
    
    # Update product usage count
    await db.products.update_one(
        {'id': sale_input.product_id},
        {'$inc': {'usage_count': 1}},
        upsert=False
    )
    
    # Update customer stats if customer_id provided
    if sale_input.customer_id:
        sale_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
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
    
    # Validar y parsear fecha personalizada
    try:
        if 'T' in sale_input.custom_date:
            custom_datetime = datetime.fromisoformat(sale_input.custom_date.replace('Z', '+00:00'))
        else:
            # Si solo es fecha (YYYY-MM-DD), agregar hora actual
            custom_datetime = datetime.fromisoformat(f"{sale_input.custom_date}T{datetime.now(timezone.utc).strftime('%H:%M:%S')}")
        
        # Asegurar que la fecha tenga timezone UTC
        if custom_datetime.tzinfo is None:
            custom_datetime = custom_datetime.replace(tzinfo=timezone.utc)
            
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de fecha inválido. Use YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS"
        )
    
    # Validar que la fecha no sea futura
    if custom_datetime > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede registrar una venta con fecha futura"
        )
    
    # Crear venta con la fecha personalizada
    sale_dict = sale_input.model_dump(exclude={'custom_date'})
    sale_dict['user_id'] = current_user.id
    sale_dict['user_name'] = current_user.name
    sale_dict['created_at'] = custom_datetime
    sale_dict['date'] = custom_datetime.isoformat()
    
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
    existing = await db.sales.find_one({'id': sale_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Update sale data
    update_data = sale_input.model_dump()
    await db.sales.update_one({'id': sale_id}, {'$set': update_data})
    
    # Fetch updated sale
    updated = await db.sales.find_one({'id': sale_id}, {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    # Rebuild Sale object with existing user data
    updated['user_id'] = existing['user_id']
    updated['user_name'] = existing['user_name']
    
    return Sale(**updated)

@router.delete("/{sale_id}")
async def delete_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    result = await db.sales.delete_one({'id': sale_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    return {"message": "Sale deleted"}
