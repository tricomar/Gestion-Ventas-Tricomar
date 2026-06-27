#!/usr/bin/env python3
"""
Script de Migración de Base de Datos

Aplica migraciones pendientes a la base de datos.
"""

import os
import sys
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'sales_management')

def ensure_migrations_collection(db):
    """Asegura que exista la colección de migraciones"""
    if 'migrations' not in db.list_collection_names():
        db.create_collection('migrations')
        print("✅ Colección 'migrations' creada")

def get_applied_migrations(db):
    """Obtiene lista de migraciones ya aplicadas"""
    migrations = db.migrations.find({}, {'_id': 0}).sort('applied_at', 1)
    return [m['name'] for m in migrations]

def apply_initial_schema(db):
    """Aplica el esquema inicial y crea índices necesarios"""
    print("\n" + "="*70)
    print("🚀 APLICANDO ESQUEMA INICIAL")
    print("="*70 + "\n")
    
    # Crear índices para cada colección
    indexes = {
        'users': [('email', 1), ('id', 1)],
        'products': [('id', 1), ('name', 1), ('store', 1)],
        'sales': [('id', 1), ('product_id', 1), ('customer_id', 1), ('date', 1), ('store', 1)],
        'expenses': [('id', 1), ('date', 1), ('store', 1), ('category', 1)],
        'income': [('id', 1), ('date', 1), ('store', 1), ('category', 1)],
        'customers': [('id', 1), ('name', 1), ('store', 1)],
        'notes': [('id', 1), ('date', 1), ('author_id', 1), ('status', 1)],
        'settings': [('id', 1)]
    }
    
    for collection_name, index_fields in indexes.items():
        collection = db[collection_name]
        
        # Crear índices
        for field, order in index_fields:
            try:
                collection.create_index([(field, order)], background=True)
                print(f"✅ Índice creado: {collection_name}.{field}")
            except Exception as e:
                print(f"⚠️  Índice ya existe o error: {collection_name}.{field}")
    
    # Asegurar que exista documento de settings
    if db.settings.count_documents({'id': 'settings'}) == 0:
        default_settings = {
            'id': 'settings',
            'store_a_name': 'Tienda A',
            'store_b_name': 'Tienda B',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        db.settings.insert_one(default_settings)
        print("✅ Configuración por defecto creada")
    
    # Registrar migración
    db.migrations.insert_one({
        'name': 'initial_schema',
        'applied_at': datetime.now().isoformat(),
        'description': 'Esquema inicial con índices'
    })
    
    print("\n✅ Esquema inicial aplicado exitosamente\n")

def migrate():
    """Ejecuta todas las migraciones pendientes"""
    print("\n" + "="*70)
    print("🔄 SISTEMA DE MIGRACIONES")
    print("="*70)
    print(f"\n📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🗄️  Base de datos: {DB_NAME}\n")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Asegurar colección de migraciones
    ensure_migrations_collection(db)
    
    # Obtener migraciones aplicadas
    applied = get_applied_migrations(db)
    print(f"📋 Migraciones aplicadas: {len(applied)}")
    
    if 'initial_schema' not in applied:
        print("\n🆕 Aplicando migración inicial...")
        apply_initial_schema(db)
    else:
        print("\n✅ No hay migraciones pendientes\n")
    
    client.close()

if __name__ == '__main__':
    try:
        migrate()
    except Exception as e:
        print(f"\n❌ Error durante la migración: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
