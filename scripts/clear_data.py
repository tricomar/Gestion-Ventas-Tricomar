#!/usr/bin/env python3
"""
Script para limpiar todos los datos de la aplicación
Mantiene solo el usuario administrador
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def clear_all_data():
    # Conectar a MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("LIMPIANDO TODOS LOS DATOS DE LA APLICACIÓN")
    print("=" * 60)
    print()
    
    # Contar registros antes de eliminar
    sales_count = await db.sales.count_documents({})
    expenses_count = await db.expenses.count_documents({})
    income_count = await db.other_income.count_documents({})
    products_count = await db.products.count_documents({})
    users_count = await db.users.count_documents({})
    
    print(f"Registros actuales:")
    print(f"  - Ventas: {sales_count}")
    print(f"  - Gastos: {expenses_count}")
    print(f"  - Otros Ingresos: {income_count}")
    print(f"  - Productos: {products_count}")
    print(f"  - Usuarios: {users_count}")
    print()
    
    # Confirmar eliminación
    confirm = input("¿Estás seguro de eliminar TODOS los datos? (escribe 'SI' para confirmar): ")
    
    if confirm != 'SI':
        print("❌ Operación cancelada")
        client.close()
        return
    
    print()
    print("Eliminando datos...")
    print()
    
    # Eliminar ventas
    result = await db.sales.delete_many({})
    print(f"✓ Ventas eliminadas: {result.deleted_count}")
    
    # Eliminar gastos
    result = await db.expenses.delete_many({})
    print(f"✓ Gastos eliminados: {result.deleted_count}")
    
    # Eliminar otros ingresos
    result = await db.other_income.delete_many({})
    print(f"✓ Otros ingresos eliminados: {result.deleted_count}")
    
    # Eliminar productos
    result = await db.products.delete_many({})
    print(f"✓ Productos eliminados: {result.deleted_count}")
    
    # Eliminar usuarios NO administradores
    result = await db.users.delete_many({'email': {'$ne': 'admin@ventas.com'}})
    print(f"✓ Usuarios (excepto admin) eliminados: {result.deleted_count}")
    
    # Mantener configuración de tiendas (settings)
    print(f"✓ Configuración de tiendas mantenida")
    
    print()
    print("=" * 60)
    print("✅ LIMPIEZA COMPLETADA")
    print("=" * 60)
    print()
    print("Usuario administrador conservado:")
    print("  Email: admin@ventas.com")
    print("  Password: admin123")
    print()
    print("Puedes comenzar a probar la aplicación desde cero.")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(clear_all_data())
