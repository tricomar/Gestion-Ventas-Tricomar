"""
Script para crear pedidos de ecommerce de demostración
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import random

async def seed_orders():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['negocio_feliz']
    
    account_id = "acc_cd0a3e485753"
    
    # Estados típicos de PrestaShop
    states = [
        {"id": "5", "name": "Entregado"},
        {"id": "6", "name": "Cancelado"},
        {"id": "7", "name": "Reembolsado"},
        {"id": "12", "name": "Pago remoto aceptado"},
        {"id": "2", "name": "Pago aceptado"},
        {"id": "3", "name": "Preparación en curso"},
        {"id": "4", "name": "Enviado"}
    ]
    
    customers = [
        {"id": 1, "name": "María González", "email": "maria@example.com"},
        {"id": 2, "name": "Juan Pérez", "email": "juan@example.com"},
        {"id": 3, "name": "Ana Martínez", "email": "ana@example.com"},
        {"id": 4, "name": "Carlos López", "email": "carlos@example.com"},
        {"id": 5, "name": "Laura Rodríguez", "email": "laura@example.com"}
    ]
    
    integrations = [
        {"id": "8f98cff7-174d-41f7-ac00-5728a7865518", "name": "GrowShop", "code": "GS"},
        {"id": "e0e3c5ad-e1d6-401c-9fa7-fa1f18f61bb3", "name": "PetShop", "code": "PS"}
    ]
    
    products_data = {
        "GS": [
            {"name": "Fertilizante Orgánico 1L", "price": 15000},
            {"name": "Maceta 30cm", "price": 8000},
            {"name": "Sustrato Premium 5kg", "price": 12000},
            {"name": "Kit de Cultivo Completo", "price": 45000},
            {"name": "Lámpara LED 50W", "price": 35000}
        ],
        "PS": [
            {"name": "Alimento Premium Perro 15kg", "price": 45000},
            {"name": "Arena para Gatos 10kg", "price": 8000},
            {"name": "Juguete Interactivo", "price": 12000},
            {"name": "Collar Antipulgas", "price": 18000},
            {"name": "Cama para Mascotas", "price": 25000}
        ]
    }
    
    orders = []
    order_id = 1
    
    # Crear pedidos de los últimos 30 días
    for day_offset in range(30):
        num_orders_today = random.randint(2, 8)
        
        for _ in range(num_orders_today):
            integration = random.choice(integrations)
            customer = random.choice(customers)
            state = random.choice(states)
            
            # Fecha del pedido
            order_date = datetime.now(timezone.utc) - timedelta(days=day_offset, hours=random.randint(0, 23))
            
            # Productos del pedido (1-3 productos)
            num_products = random.randint(1, 3)
            products = random.sample(products_data[integration["code"]], num_products)
            
            total_products = sum(p["price"] * random.randint(1, 2) for p in products)
            shipping = 5000 if total_products < 30000 else 0
            total_paid = total_products + shipping
            
            # Crear items del pedido
            order_items = []
            for product in products:
                quantity = random.randint(1, 2)
                order_items.append({
                    "product_name": product["name"],
                    "product_price": product["price"],
                    "product_quantity": quantity,
                    "total_price": product["price"] * quantity
                })
            
            order = {
                "account_id": account_id,
                "integration_id": integration["id"],
                "store_name": integration["name"],
                "store_code": integration["code"],
                "id": str(order_id),
                "reference": f"{integration['code']}{str(order_id).zfill(5)}",
                "customer_id": customer["id"],
                "customer_name": customer["name"],
                "customer_email": customer["email"],
                "total_paid": round(total_paid, 2),
                "total_products": round(total_products, 2),
                "shipping_cost": shipping,
                "current_state": state["id"],
                "state_name": state["name"],
                "status": state["id"],
                "payment_method": random.choice(["Transferencia", "Tarjeta de Crédito", "Webpay", "PayPal"]),
                "items": order_items,
                "date_add": order_date.isoformat(),
                "date_upd": order_date.isoformat(),
                "created_at": order_date.isoformat(),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
            orders.append(order)
            order_id += 1
    
    # Insertar todos los pedidos
    if orders:
        await db.ecommerce_orders.insert_many(orders)
        print(f"✅ Se crearon {len(orders)} pedidos de demostración")
        
        # Resumen por estado
        print("\n📊 Resumen por estado:")
        pipeline = [
            {"$group": {"_id": "$state_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        summary = await db.ecommerce_orders.aggregate(pipeline).to_list(100)
        for item in summary:
            print(f"   {item['_id']}: {item['count']} pedidos")
        
        # Resumen por tienda
        print("\n🏪 Resumen por tienda:")
        pipeline = [
            {"$group": {"_id": "$store_name", "count": {"$sum": 1}, "total": {"$sum": "$total_paid"}}},
            {"$sort": {"count": -1}}
        ]
        summary = await db.ecommerce_orders.aggregate(pipeline).to_list(100)
        for item in summary:
            print(f"   {item['_id']}: {item['count']} pedidos, Total: ${item['total']:,.0f}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_orders())
