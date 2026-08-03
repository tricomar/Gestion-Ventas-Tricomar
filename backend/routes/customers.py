"""
Router para gestión de clientes CRM
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt

from models.customers import Customer, CustomerBase, CustomerCreate, CustomerUpdate
from middleware.tenant import get_tenant_filter, add_account_id_to_document
from utils import db, get_current_user, require_admin
from models.users import User

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    """Obtener todos los clientes"""
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict())
    customers = await db.customers.find(tenant_filter, {'_id': 0}).sort('name', 1).to_list(1000)
    
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
    # Agregar account_id (tenant isolation)
    doc = add_account_id_to_document(current_user.dict(), doc)

    await db.customers.insert_one(doc)
    
    return customer


@router.get("/{customer_id}/detail")
async def get_customer_detail(customer_id: str, current_user: User = Depends(get_current_user)):
    """
    Obtener detalle completo del cliente incluyendo:
    - Información básica del cliente
    - Últimas 3 compras
    - Predicción de próxima compra basada en historial de 3 meses
    """
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict(), {'id': customer_id})
    
    # Obtener cliente
    customer = await db.customers.find_one(tenant_filter, {'_id': 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Convertir created_at si es string
    if isinstance(customer.get('created_at'), str):
        customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    
    # Obtener ventas del cliente (últimas 3)
    sales_filter = get_tenant_filter(current_user.dict(), {'customer_id': customer_id})
    sales = await db.sales.find(
        sales_filter,
        {'_id': 0}
    ).sort('created_at', -1).limit(3).to_list(3)
    
    # Enriquecer ventas con información de productos
    enriched_sales = []
    for sale in sales:
        product = await db.products.find_one(
            get_tenant_filter(current_user.dict(), {'id': sale['product_id']}),
            {'_id': 0}
        )
        enriched_sales.append({
            'product_name': product['name'] if product else 'Producto eliminado',
            'quantity': sale.get('quantity', 1),
            'total': sale.get('total', 0),
            'date': sale.get('created_at', ''),
            'store': sale.get('store', '')
        })
    
    # Calcular predicción de próxima compra (últimos 3 meses)
    three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
    all_sales_filter = get_tenant_filter(current_user.dict(), {'customer_id': customer_id})
    
    all_sales = await db.sales.find(
        all_sales_filter,
        {'_id': 0, 'created_at': 1, 'product_id': 1, 'total': 1}
    ).sort('created_at', -1).to_list(1000)
    
    # Filtrar ventas de los últimos 3 meses
    recent_sales = []
    for sale in all_sales:
        sale_date_str = sale.get('created_at')
        if sale_date_str:
            if isinstance(sale_date_str, str):
                sale_date = datetime.fromisoformat(sale_date_str.replace('Z', '+00:00'))
            else:
                sale_date = sale_date_str
            
            if sale_date >= three_months_ago:
                recent_sales.append({
                    'date': sale_date,
                    'product_id': sale.get('product_id'),
                    'total': sale.get('total', 0)
                })
    
    prediction = calculate_purchase_prediction(recent_sales)
    
    return {
        'customer': customer,
        'recent_purchases': enriched_sales,
        'prediction': prediction
    }


def calculate_purchase_prediction(sales: List[Dict]) -> Dict:
    """
    Calcula la predicción de próxima compra combinando:
    1. Promedio de días entre compras
    2. Análisis de frecuencia por producto
    """
    if len(sales) < 2:
        return {
            'status': 'insufficient_data',
            'message': 'Datos insuficientes para predicción',
            'next_purchase_date': None,
            'frequent_products': [],
            'avg_days_between_purchases': None
        }
    
    # Ordenar ventas por fecha
    sorted_sales = sorted(sales, key=lambda x: x['date'])
    
    # Calcular días entre compras
    days_between = []
    for i in range(1, len(sorted_sales)):
        delta = (sorted_sales[i]['date'] - sorted_sales[i-1]['date']).days
        if delta > 0:  # Ignorar compras el mismo día
            days_between.append(delta)
    
    if not days_between:
        return {
            'status': 'insufficient_data',
            'message': 'Datos insuficientes para predicción',
            'next_purchase_date': None,
            'frequent_products': [],
            'avg_days_between_purchases': None
        }
    
    # Promedio de días entre compras
    avg_days = sum(days_between) / len(days_between)
    
    # Calcular fecha estimada de próxima compra
    last_purchase_date = sorted_sales[-1]['date']
    next_purchase_date = last_purchase_date + timedelta(days=int(avg_days))
    
    # Análisis de frecuencia de productos
    product_frequency = {}
    for sale in sorted_sales:
        product_id = sale.get('product_id')
        if product_id:
            product_frequency[product_id] = product_frequency.get(product_id, 0) + 1
    
    # Obtener productos más frecuentes
    frequent_products = sorted(
        product_frequency.items(),
        key=lambda x: x[1],
        reverse=True
    )[:3]  # Top 3 productos
    
    # Calcular confianza de la predicción
    confidence = min(len(sales) / 10.0, 1.0) * 100  # Máximo 100% con 10+ compras
    
    return {
        'status': 'success',
        'message': 'Predicción calculada exitosamente',
        'next_purchase_date': next_purchase_date.isoformat(),
        'avg_days_between_purchases': round(avg_days, 1),
        'confidence_level': round(confidence, 0),
        'total_purchases_analyzed': len(sorted_sales),
        'frequent_product_ids': [pid for pid, _ in frequent_products],
        'frequent_product_counts': [count for _, count in frequent_products]
    }
