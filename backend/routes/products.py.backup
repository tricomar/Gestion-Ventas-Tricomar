"""
Router para gestión de productos e inventario
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import bcrypt

from models.products import Product, ProductBase, ProductCreate
from utils import db, get_current_user, require_admin
from models.users import User

router = APIRouter(prefix="/products", tags=["products"])

@router.get("", response_model=List[Product])
async def get_products(current_user: User = Depends(get_current_user)):
    products = await db.products.find({}, {'_id': 0}).sort('name', 1).to_list(10000)
    
    result = []
    for prod in products:
        if isinstance(prod.get('created_at'), str):
            prod['created_at'] = datetime.fromisoformat(prod['created_at'])
        
        # Generate and save 'id' if missing (legacy products)
        if 'id' not in prod:
            prod['id'] = str(uuid.uuid4())
            # Update the document with the new id
            await db.products.update_one(
                {'name': prod['name']},
                {'$set': {'id': prod['id']}}
            )
        
        # Backfill legacy products with defaults
        if 'store' not in prod:
            prod['store'] = 'A'
        if 'cost_price' not in prod:
            prod['cost_price'] = prod.get('last_price', 0) * 0.6 if prod.get('last_price') else 0
        if 'sale_price' not in prod:
            prod['sale_price'] = prod.get('last_price', 0)
        if 'usage_count' not in prod:
            prod['usage_count'] = 0
            
        # Update legacy product in DB
        if 'last_price' in prod and ('store' not in prod or 'cost_price' not in prod):
            await db.products.update_one(
                {'id': prod['id']},
                {'$set': {
                    'store': prod['store'],
                    'cost_price': prod['cost_price'],
                    'sale_price': prod['sale_price']
                }}
            )
        
        result.append(Product(**prod))
    
    return result

@router.get("/search")
async def search_products(q: str, current_user: User = Depends(get_current_user)):
    products = await db.products.find(
        {'name': {'$regex': q, '$options': 'i'}},
        {'_id': 0}
    ).sort('usage_count', -1).limit(10).to_list(10)
    return products

@router.post("", response_model=Product)
async def create_product(product_input: ProductCreate, current_user: User = Depends(get_current_user)):
    # Check if product exists
    existing = await db.products.find_one({'name': product_input.name}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Product already exists")
    
    # Create new product
    product = Product(**product_input.model_dump(), usage_count=0)
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    
    return product

@router.put("/{product_id}", response_model=Product)
async def update_product(product_id: str, product_input: ProductCreate, current_user: User = Depends(get_current_user)):
    existing = await db.products.find_one({'id': product_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_input.model_dump()
    await db.products.update_one({'id': product_id}, {'$set': update_data})
    
    updated = await db.products.find_one({'id': product_id}, {'_id': 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Product(**updated)

@router.delete("/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    result = await db.products.delete_one({'id': product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@router.get("/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({'id': product_id}, {'_id': 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)
