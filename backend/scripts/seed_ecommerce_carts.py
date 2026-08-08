"""
Script para crear carritos de ecommerce de demostración
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
import random

async def seed_carts():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['negocio_feliz']
    
    account_id = "acc_cd0a3e485753"
    
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
    
    cart_id = 1
    carts = []
    
    # Crear carritos de los últimos 30 días
    for day_offset in range(30):
        num_carts_today = random.randint(3, 8)
        
        for _ in range(num_carts_today):
            integration = random.choice(integrations)
            customer = random.choice(customers)
            
            # Fecha del carrito
            cart_date = datetime.now(timezone.utc) - timedelta(days=day_offset, hours=random.randint(0, 23))
            
            # Productos del carrito (1-4 productos)
            num_products = random.randint(1, 4)
            products = random.sample(products_data[integration["code"]], min(num_products, len(products_data[integration["code"]])))
            
            cart_items = []
            total_products = 0
            for product in products:
                quantity = random.randint(1, 3)
                product_total = product["price"] * quantity
                total_products += product_total
                
                cart_items.append({
                    "product_name": product["name"],
                    "product_price": product["price"],
                    "quantity": quantity,
                    "total": product_total
                })
            
            # Determinar estado del carrito
            # 70% abandonados, 20% activos, 10% finalizados
            rand = random.random()
            if rand < 0.7:
                status = "abandoned"
                # Los carritos abandonados tienen al menos 2 horas
                cart_date = datetime.now(timezone.utc) - timedelta(days=day_offset, hours=random.randint(2, 23))
            elif rand < 0.9:
                status = "active"
                # Los carritos activos son más recientes
                cart_date = datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 6))
            else:
                status = "converted"
            
            cart = {
                "account_id": account_id,
                "integration_id": integration["id"],
                "store_name": integration["name"],
                "store_code": integration["code"],
                "id": str(cart_id),
                "cart_id": str(cart_id),
                "customer_id": customer["id"],
                "customer_name": customer["name"],
                "customer_email": customer["email"],
                "items": cart_items,
                "total_products": round(total_products, 2),
                "status": status,
                "created_at": cart_date.isoformat(),
                "updated_at": cart_date.isoformat(),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
            carts.append(cart)
            cart_id += 1
    
    # Insertar todos los carritos
    if carts:
        await db.ecommerce_carts.insert_many(carts)
        print(f"✅ Se crearon {len(carts)} carritos de demostración")
        
        # Resumen por estado
        print("\n📊 Resumen por estado:")
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$total_products"}}},
            {"$sort": {"count": -1}}
        ]
        summary = await db.ecommerce_carts.aggregate(pipeline).to_list(100)
        for item in summary:
            print(f"   {item['_id'].capitalize()}: {item['count']} carritos, Total: ${item['total']:,.0f}")
        
        # Resumen por tienda
        print("\n🏪 Resumen por tienda:")
        pipeline = [
            {"$group": {"_id": "$store_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        summary = await db.ecommerce_carts.aggregate(pipeline).to_list(100)
        for item in summary:
            print(f"   {item['_id']}: {item['count']} carritos")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_carts())
