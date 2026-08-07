"""
Routes for reports and analytics
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from models.users import User
from utils.auth import get_current_user
from utils.database import db
from middleware.tenant import get_tenant_filter
from utils.timezone_utils import get_account_timezone

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/data")
async def get_report_data(
    period: str = Query(..., description="day, week, month, custom"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    store: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive report data using configured timezone
    """
    try:
        # Get user's configured timezone
        user_tz_str = await get_account_timezone(current_user.account_id)
        user_tz = ZoneInfo(user_tz_str)
        
        # Determine date range using user's timezone
        end_dt = datetime.now(user_tz)
        
        if period == 'day':
            start_dt = end_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'week':
            start_dt = end_dt - timedelta(days=7)
        elif period == 'month':
            start_dt = end_dt - timedelta(days=30)
        elif period == 'custom' and start_date and end_date:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
        else:
            start_dt = end_dt - timedelta(days=30)
        
        # Build query filter
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        date_filter = {
            'created_at': {
                '$gte': start_dt.isoformat(),
                '$lte': end_dt.isoformat()
            }
        }
        
        query_filter = {**tenant_filter, **date_filter}
        
        # Add store filter if provided
        if store and store != 'all':
            query_filter['store'] = store
        
        # Fetch sales data
        sales = await db.sales_records.find(query_filter, {'_id': 0}).to_list(10000)
        
        # Fetch expenses
        expenses = await db.expenses_records.find(query_filter, {'_id': 0}).to_list(10000)
        
        # Fetch other income
        other_income = await db.income_records.find(query_filter, {'_id': 0}).to_list(10000)
        
        # Calculate totals by store
        store_a_sales = [s for s in sales if s.get('store') == 'A']
        store_b_sales = [s for s in sales if s.get('store') == 'B']
        
        store_a_total = sum(s.get('total', 0) for s in store_a_sales)
        store_b_total = sum(s.get('total', 0) for s in store_b_sales)
        store_a_cost = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in store_a_sales)
        store_b_cost = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in store_b_sales)
        
        total_expenses_amount = sum(e.get('amount', 0) for e in expenses)
        total_other_income_amount = sum(i.get('amount', 0) for i in other_income)
        
        # Group sales by product
        products_sales = {}
        for sale in sales:
            product_name = sale.get('product_name', 'Sin nombre')
            if product_name not in products_sales:
                products_sales[product_name] = {
                    'name': product_name,
                    'quantity': 0,
                    'total': 0
                }
            products_sales[product_name]['quantity'] += sale.get('quantity', 0)
            products_sales[product_name]['total'] += sale.get('total', 0)
        
        top_products = sorted(
            products_sales.values(),
            key=lambda x: x['total'],
            reverse=True
        )[:10]
        
        # Group sales by category
        categories_sales = {}
        for sale in sales:
            category = sale.get('category', 'Sin categoría')
            if category not in categories_sales:
                categories_sales[category] = {
                    'name': category,
                    'quantity': 0,
                    'total': 0
                }
            categories_sales[category]['quantity'] += sale.get('quantity', 0)
            categories_sales[category]['total'] += sale.get('total', 0)
        
        top_categories = sorted(
            categories_sales.values(),
            key=lambda x: x['total'],
            reverse=True
        )[:5]
        
        # Group sales by payment method
        payment_methods = {}
        for sale in sales:
            method = sale.get('payment_method', 'Efectivo')
            if method not in payment_methods:
                payment_methods[method] = {'count': 0, 'total': 0}
            payment_methods[method]['count'] += 1
            payment_methods[method]['total'] += sale.get('total', 0)
        
        # Daily sales for chart
        daily_sales = {}
        for sale in sales:
            date_str = sale.get('created_at', '')[:10]  # YYYY-MM-DD
            if date_str not in daily_sales:
                daily_sales[date_str] = 0
            daily_sales[date_str] += sale.get('total', 0)
        
        daily_sales_chart = [
            {'date': date, 'total': total}
            for date, total in sorted(daily_sales.items())
        ]
        
        return {
            'period': period,
            'start_date': start_dt.isoformat(),
            'end_date': end_dt.isoformat(),
            'store_a': {
                'sales_count': len(store_a_sales),
                'total_sales': store_a_total,
                'total_cost': store_a_cost,
                'profit': store_a_total - store_a_cost
            },
            'store_b': {
                'sales_count': len(store_b_sales),
                'total_sales': store_b_total,
                'total_cost': store_b_cost,
                'profit': store_b_total - store_b_cost
            },
            'total_sales': store_a_total + store_b_total,
            'total_profit': (store_a_total - store_a_cost) + (store_b_total - store_b_cost),
            'total_expenses': total_expenses_amount,
            'total_other_income': total_other_income_amount,
            'net_profit': (store_a_total + store_b_total - store_a_cost - store_b_cost - total_expenses_amount + total_other_income_amount),
            'sales': sales[:100],  # Limit to 100 for detail
            'expenses': expenses[:100],
            'other_income': other_income[:100],
            'top_products': top_products,
            'top_categories': top_categories,
            'payment_methods': payment_methods,
            'daily_sales_chart': daily_sales_chart
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {str(e)}"
        )


@router.get("/top-products")
async def get_top_products(
    period: str = Query('month', description="day, week, month, year"),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """Get top selling products"""
    try:
        # Date range
        end_dt = datetime.now(timezone.utc)
        if period == 'day':
            start_dt = end_dt - timedelta(days=1)
        elif period == 'week':
            start_dt = end_dt - timedelta(days=7)
        elif period == 'month':
            start_dt = end_dt - timedelta(days=30)
        elif period == 'year':
            start_dt = end_dt - timedelta(days=365)
        else:
            start_dt = end_dt - timedelta(days=30)
        
        tenant_filter = get_tenant_filter(current_user.dict(), {})
        query_filter = {
            **tenant_filter,
            'created_at': {
                '$gte': start_dt.isoformat(),
                '$lte': end_dt.isoformat()
            }
        }
        
        sales = await db.sales_records.find(query_filter, {'_id': 0}).to_list(10000)
        
        # Group by product
        products = {}
        for sale in sales:
            product_name = sale.get('product_name', 'Sin nombre')
            if product_name not in products:
                products[product_name] = {
                    'name': product_name,
                    'quantity': 0,
                    'revenue': 0
                }
            products[product_name]['quantity'] += sale.get('quantity', 0)
            products[product_name]['revenue'] += sale.get('total', 0)
        
        top_products = sorted(
            products.values(),
            key=lambda x: x['revenue'],
            reverse=True
        )[:limit]
        
        return {
            'period': period,
            'products': top_products
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching top products: {str(e)}"
        )
