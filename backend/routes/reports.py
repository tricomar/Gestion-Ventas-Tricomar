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
        from utils.timezone_utils import (
            get_day_boundaries_utc,
            get_month_boundaries_utc,
            now_local,
            to_local_date,
            get_account_currency
        )
        from collections import defaultdict
        
        # Get user's configured timezone and currency
        user_tz_str = await get_account_timezone(current_user.account_id)
        currency_config = await get_account_currency(current_user.account_id)
        
        # Get current local time
        local_now = now_local(user_tz_str)
        
        # Determine date range using UTC boundaries
        if period == 'day':
            today_str = local_now.strftime("%Y-%m-%d")
            start_utc, end_utc = get_day_boundaries_utc(today_str, user_tz_str)
        elif period == 'week':
            # Last 7 days
            start_local = local_now - timedelta(days=7)
            start_str = start_local.strftime("%Y-%m-%d")
            end_str = local_now.strftime("%Y-%m-%d")
            start_utc, _ = get_day_boundaries_utc(start_str, user_tz_str)
            _, end_utc = get_day_boundaries_utc(end_str, user_tz_str)
        elif period == 'month':
            # Current month
            start_utc, end_utc = get_month_boundaries_utc(
                local_now.year,
                local_now.month,
                user_tz_str
            )
        elif period == 'custom' and start_date and end_date:
            # Custom range (dates in local timezone)
            start_utc, _ = get_day_boundaries_utc(start_date, user_tz_str)
            _, end_utc = get_day_boundaries_utc(end_date, user_tz_str)
        else:
            # Default to last 30 days
            start_local = local_now - timedelta(days=30)
            start_str = start_local.strftime("%Y-%m-%d")
            end_str = local_now.strftime("%Y-%m-%d")
            start_utc, _ = get_day_boundaries_utc(start_str, user_tz_str)
            _, end_utc = get_day_boundaries_utc(end_str, user_tz_str)
        
        # Build base query
        base_query = {
            'account_id': current_user.account_id,
            'created_at': {'$gte': start_utc, '$lte': end_utc}
        }
        
        # Fetch sales from POS (collection: sales)
        sales_query = base_query.copy()
        if store and store != 'all':
            sales_query['store'] = store
        
        sales = await db.sales.find(sales_query, {'_id': 0}).to_list(100000)
        
        # Fetch ecommerce orders
        ecommerce_orders = await db.ecommerce_orders.find(base_query, {'_id': 0}).to_list(100000)
        
        # Fetch expenses
        expenses = await db.expenses.find(base_query, {'_id': 0}).to_list(10000)
        
        # Fetch other income
        income = await db.income.find(base_query, {'_id': 0}).to_list(10000)
        
        # Calculate totals by store (POS only)
        store_totals = defaultdict(lambda: {'sales': 0, 'cost': 0, 'profit': 0})
        
        for sale in sales:
            store_id = sale.get('store', 'A')
            total = sale.get('total', 0)
            cost = sale.get('cost_price', 0) * sale.get('quantity', 0)
            
            store_totals[store_id]['sales'] += total
            store_totals[store_id]['cost'] += cost
            store_totals[store_id]['profit'] += (total - cost)
        
        # Add ecommerce as separate category
        ecommerce_total = sum(float(o.get('total_paid', 0)) for o in ecommerce_orders)
        
        # Calculate total sales (POS + Ecommerce)
        pos_total = sum(s.get('total', 0) for s in sales)
        total_sales = pos_total + ecommerce_total
        
        # Calculate expenses and income
        total_expenses = sum(e.get('amount', 0) for e in expenses)
        total_income = sum(i.get('amount', 0) for i in income)
        
        # Group sales by product (POS only)
        products_sales = defaultdict(lambda: {'name': '', 'quantity': 0, 'total': 0})
        
        for sale in sales:
            product_name = sale.get('product_name', 'Sin nombre')
            products_sales[product_name]['name'] = product_name
            products_sales[product_name]['quantity'] += sale.get('quantity', 0)
            products_sales[product_name]['total'] += sale.get('total', 0)
        
        top_products = sorted(
            products_sales.values(),
            key=lambda x: x['total'],
            reverse=True
        )[:10]
        
        # Group sales by day (local date)
        daily_sales = defaultdict(lambda: {'pos': 0, 'ecommerce': 0, 'total': 0})
        
        for sale in sales:
            local_date = to_local_date(sale.get('created_at'), user_tz_str)
            if local_date:
                daily_sales[local_date]['pos'] += sale.get('total', 0)
                daily_sales[local_date]['total'] += sale.get('total', 0)
        
        for order in ecommerce_orders:
            local_date = to_local_date(order.get('created_at'), user_tz_str)
            if local_date:
                daily_sales[local_date]['ecommerce'] += float(order.get('total_paid', 0))
                daily_sales[local_date]['total'] += float(order.get('total_paid', 0))
        
        # Convert to list and sort
        daily_chart = [
            {'date': date, **values}
            for date, values in sorted(daily_sales.items())
        ]
        
        return {
            'period': period,
            'start_date': start_date or start_utc[:10],
            'end_date': end_date or end_utc[:10],
            'timezone': user_tz_str,
            'currency_symbol': currency_config['symbol'],
            'currency_code': currency_config['code'],
            'summary': {
                'total_sales': total_sales,
                'pos_sales': pos_total,
                'ecommerce_sales': ecommerce_total,
                'total_expenses': total_expenses,
                'total_income': total_income,
                'net_profit': total_sales - total_expenses + total_income
            },
            'by_store': dict(store_totals),
            'top_products': top_products,
            'daily_chart': daily_chart,
            'transactions_count': len(sales) + len(ecommerce_orders)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
