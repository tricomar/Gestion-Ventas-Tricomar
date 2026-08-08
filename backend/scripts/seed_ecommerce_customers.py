"""
Script para crear datos de clientes de ecommerce
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import random
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv('/app/backend/.env')

async def seed_customers():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'negocio_feliz')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    account_id = "acc_cd0a3e485753"
    
    # Obtener pedidos existentes para extraer clientes únicos
    orders = await db.ecommerce_orders.find({"account_id": account_id}, {"_id": 0}).to_list(1000)
    
    # Agrupar por cliente
    customers_data = {}
    for order in orders:
        customer_id = str(order.get('customer_id'))
        if customer_id not in customers_data:
            customers_data[customer_id] = {
                "account_id": account_id,
                "customer_id": customer_id,
                "name": order.get('customer_name', f'Cliente {customer_id}'),
                "email": order.get('customer_email', f'cliente{customer_id}@example.com'),
                "orders": [],
                "total_spent": 0,
                "first_order_date": order.get('date_add'),
                "last_order_date": order.get('date_add'),
                "order_count": 0
            }
        
        # Agregar pedido
        customers_data[customer_id]['orders'].append({
            "order_id": order.get('id'),
            "order_reference": order.get('reference'),
            "date": order.get('date_add'),
            "total": float(order.get('total_paid', 0)),
            "status": order.get('state_name', 'Desconocido')
        })
        
        customers_data[customer_id]['total_spent'] += float(order.get('total_paid', 0))
        customers_data[customer_id]['order_count'] += 1
        
        # Actualizar fechas
        order_date = order.get('date_add')
        if order_date < customers_data[customer_id]['first_order_date']:
            customers_data[customer_id]['first_order_date'] = order_date
        if order_date > customers_data[customer_id]['last_order_date']:
            customers_data[customer_id]['last_order_date'] = order_date
    
    # Determinar si es nuevo o recurrente
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    customers = []
    for customer_id, data in customers_data.items():
        # Cliente es nuevo si su primera compra fue en los últimos 30 días
        first_order_str = data['first_order_date']
        # Parsear fecha sin timezone y añadir UTC
        first_order_dt = datetime.strptime(first_order_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        is_new = first_order_dt >= thirty_days_ago
        
        # Cliente es recurrente si tiene más de 1 pedido
        is_recurring = data['order_count'] > 1
        
        # Calcular promedio de compra
        avg_order_value = data['total_spent'] / data['order_count'] if data['order_count'] > 0 else 0
        
        # Calcular días desde última compra
        last_order_str = data['last_order_date']
        last_order_dt = datetime.strptime(last_order_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        days_since_last_order = (now - last_order_dt).days
        
        customer = {
            "account_id": account_id,
            "customer_id": customer_id,
            "name": data['name'],
            "email": data['email'],
            "phone": f"+569{random.randint(10000000, 99999999)}" if random.random() > 0.3 else None,
            "orders": data['orders'],
            "order_count": data['order_count'],
            "total_spent": round(data['total_spent'], 2),
            "average_order_value": round(avg_order_value, 2),
            "first_order_date": data['first_order_date'],
            "last_order_date": data['last_order_date'],
            "days_since_last_order": days_since_last_order,
            "is_new": is_new,
            "is_recurring": is_recurring,
            "customer_type": "new" if is_new else ("recurring" if is_recurring else "one-time"),
            "created_at": data['first_order_date'],
            "updated_at": data['last_order_date'],
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        customers.append(customer)
    
    # Insertar clientes
    if customers:
        # Limpiar colección existente
        await db.ecommerce_customers.delete_many({"account_id": account_id})
        
        # Insertar nuevos
        await db.ecommerce_customers.insert_many(customers)
        print(f"✅ Se crearon {len(customers)} clientes")
        
        # Resumen
        new_customers = sum(1 for c in customers if c['is_new'])
        recurring_customers = sum(1 for c in customers if c['is_recurring'])
        one_time_customers = len(customers) - new_customers - recurring_customers
        
        print(f"\n📊 Resumen:")
        print(f"   Nuevos (últimos 30 días): {new_customers}")
        print(f"   Recurrentes (2+ pedidos): {recurring_customers}")
        print(f"   Una sola compra: {one_time_customers}")
        
        # Top 5 clientes
        top_customers = sorted(customers, key=lambda x: x['total_spent'], reverse=True)[:5]
        print(f"\n💰 Top 5 clientes:")
        for i, customer in enumerate(top_customers, 1):
            print(f"   {i}. {customer['name']}: ${customer['total_spent']:,.0f} ({customer['order_count']} pedidos)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_customers())
