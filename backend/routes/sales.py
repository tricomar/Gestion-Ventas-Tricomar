"""
Router para gestión de ventas
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt

from models.sales import Sale, SaleCreate
from utils import db, get_current_user, require_admin
from models.users import User

router = APIRouter(prefix="/sales", tags=["sales"])

@router.post("/sales", response_model=Sale)
async def create_sale(sale_input: SaleCreate, current_user: User = Depends(get_current_user)):
    # Create sale with user-provided total
    sale_dict = sale_input.model_dump()
    sale_dict['user_id'] = current_user.id
    sale_dict['user_name'] = current_user.name
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

@router.get("/sales", response_model=List[Sale])
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

@router.put("/sales/{sale_id}", response_model=Sale)
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

@router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    result = await db.sales.delete_one({'id': sale_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    return {"message": "Sale deleted"}
