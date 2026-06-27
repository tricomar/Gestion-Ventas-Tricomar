#!/usr/bin/env python3
"""
Validador de Esquema de Base de Datos

Este script compara el esquema actual de MongoDB con el esquema esperado
y te notifica de cualquier diferencia.
"""

import os
import sys
import json
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from typing import Dict, List, Any
from collections import defaultdict

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'sales_management')

# Esquema esperado basado en tu implementación actual
EXPECTED_SCHEMA = {
    'users': {
        'required_fields': ['id', 'email', 'password_hash', 'name', 'role', 'created_at'],
        'optional_fields': [],
        'indexes': ['email', 'id'],
        'description': 'Usuarios del sistema con autenticación'
    },
    'products': {
        'required_fields': ['id', 'name', 'cost_price', 'sale_price', 'store', 'category', 'stock', 'created_at'],
        'optional_fields': ['sku', 'description', 'updated_at'],
        'indexes': ['id', 'name', 'store'],
        'description': 'Inventario de productos'
    },
    'sales': {
        'required_fields': ['id', 'product_id', 'product_name', 'quantity', 'total', 'profit', 'payment_method', 'store', 'date', 'created_at'],
        'optional_fields': ['customer_id', 'customer_name', 'has_tax', 'cost_price', 'sale_price'],
        'indexes': ['id', 'product_id', 'customer_id', 'date', 'store'],
        'description': 'Registro de ventas'
    },
    'expenses': {
        'required_fields': ['id', 'description', 'amount', 'category', 'store', 'date', 'created_at'],
        'optional_fields': ['payment_method', 'notes'],
        'indexes': ['id', 'date', 'store', 'category'],
        'description': 'Gastos del negocio'
    },
    'income': {
        'required_fields': ['id', 'description', 'amount', 'category', 'store', 'date', 'created_at'],
        'optional_fields': ['payment_method', 'notes'],
        'indexes': ['id', 'date', 'store', 'category'],
        'description': 'Otros ingresos (no ventas)'
    },
    'customers': {
        'required_fields': ['id', 'name', 'store', 'total_spent', 'created_at'],
        'optional_fields': ['address', 'phone', 'email', 'last_purchase_date', 'purchase_count'],
        'indexes': ['id', 'name', 'store'],
        'description': 'Clientes del CRM'
    },
    'notes': {
        'required_fields': ['id', 'date', 'subject', 'message', 'author_id', 'status', 'created_at'],
        'optional_fields': ['mentions', 'updated_at', 'read_by'],
        'indexes': ['id', 'date', 'author_id', 'status'],
        'description': 'Notas y calendario diario'
    },
    'settings': {
        'required_fields': ['id', 'store_a_name', 'store_b_name', 'created_at', 'updated_at'],
        'optional_fields': [],
        'indexes': ['id'],
        'description': 'Configuración global de la aplicación'
    }
}

def get_collection_schema(collection) -> Dict[str, Any]:
    """Obtiene el esquema real de una colección analizando sus documentos"""
    # Obtener una muestra de documentos
    sample = list(collection.find().limit(100))
    
    if not sample:
        return {'fields': set(), 'count': 0}
    
    # Recopilar todos los campos que existen
    all_fields = set()
    for doc in sample:
        all_fields.update(doc.keys())
    
    # Remover _id de MongoDB
    all_fields.discard('_id')
    
    return {
        'fields': all_fields,
        'count': collection.count_documents({}),
        'sample_doc': sample[0] if sample else None
    }

def validate_schema() -> Dict[str, Any]:
    """Valida el esquema actual contra el esperado"""
    print("\n" + "="*70)
    print("🔍 VALIDADOR DE ESQUEMA DE BASE DE DATOS")
    print("="*70)
    print(f"\n📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🗄️  Base de datos: {DB_NAME}\n")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    results = {
        'missing_collections': [],
        'new_collections': [],
        'missing_fields': defaultdict(list),
        'new_fields': defaultdict(list),
        'collection_stats': {},
        'warnings': [],
        'timestamp': datetime.now().isoformat()
    }
    
    # Obtener colecciones existentes
    existing_collections = set(db.list_collection_names())
    expected_collections = set(EXPECTED_SCHEMA.keys())
    
    # 1. Verificar colecciones faltantes
    results['missing_collections'] = list(expected_collections - existing_collections)
    
    # 2. Detectar colecciones nuevas no documentadas
    results['new_collections'] = list(existing_collections - expected_collections)
    
    # 3. Validar campos en cada colección
    for coll_name in expected_collections:
        if coll_name not in existing_collections:
            continue
            
        collection = db[coll_name]
        schema = get_collection_schema(collection)
        expected = EXPECTED_SCHEMA[coll_name]
        
        results['collection_stats'][coll_name] = {
            'count': schema['count'],
            'description': expected['description']
        }
        
        # Campos requeridos faltantes
        existing_fields = schema['fields']
        required_fields = set(expected['required_fields'])
        missing = required_fields - existing_fields
        
        if missing:
            results['missing_fields'][coll_name] = list(missing)
        
        # Campos nuevos detectados
        all_expected = set(expected['required_fields'] + expected['optional_fields'])
        new_fields = existing_fields - all_expected
        
        if new_fields:
            results['new_fields'][coll_name] = list(new_fields)
    
    # Imprimir reporte
    print_report(results)
    
    # Guardar reporte en archivo
    report_path = '/app/backend/migrations/last_validation.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Reporte guardado en: {report_path}\n")
    
    client.close()
    return results

def print_report(results: Dict[str, Any]):
    """Imprime un reporte legible de los resultados"""
    has_issues = False
    
    # Colecciones faltantes
    if results['missing_collections']:
        has_issues = True
        print("\n⚠️  COLECCIONES FALTANTES:")
        for coll in results['missing_collections']:
            desc = EXPECTED_SCHEMA[coll]['description']
            print(f"   - {coll}: {desc}")
    
    # Colecciones nuevas
    if results['new_collections']:
        has_issues = True
        print("\n🆕 COLECCIONES NUEVAS DETECTADAS (no documentadas):")
        for coll in results['new_collections']:
            print(f"   - {coll}")
        print("\n   ⚡ ACCIÓN REQUERIDA: Actualiza EXPECTED_SCHEMA en schema_validator.py")
    
    # Campos faltantes
    if results['missing_fields']:
        has_issues = True
        print("\n⚠️  CAMPOS REQUERIDOS FALTANTES:")
        for coll, fields in results['missing_fields'].items():
            print(f"   - {coll}: {', '.join(fields)}")
    
    # Campos nuevos
    if results['new_fields']:
        has_issues = True
        print("\n🆕 CAMPOS NUEVOS DETECTADOS:")
        for coll, fields in results['new_fields'].items():
            print(f"   - {coll}: {', '.join(fields)}")
        print("\n   ⚡ ACCIÓN REQUERIDA: Actualiza EXPECTED_SCHEMA en schema_validator.py")
    
    # Estadísticas
    if results['collection_stats']:
        print("\n📊 ESTADÍSTICAS DE COLECCIONES:")
        for coll, stats in results['collection_stats'].items():
            print(f"   - {coll}: {stats['count']} documentos")
    
    if not has_issues:
        print("\n✅ ¡TODO EN ORDEN! El esquema está actualizado.\n")
    else:
        print("\n" + "="*70)
        print("⚠️  SE DETECTARON CAMBIOS EN EL ESQUEMA")
        print("="*70)
        print("\n📝 Próximos pasos:")
        print("   1. Revisa los cambios detectados arriba")
        print("   2. Actualiza EXPECTED_SCHEMA en schema_validator.py")
        print("   3. Crea una migración si es necesario")
        print("   4. Actualiza SCHEMA_CHANGELOG.md\n")

if __name__ == '__main__':
    try:
        validate_schema()
    except Exception as e:
        print(f"\n❌ Error durante la validación: {str(e)}")
        sys.exit(1)
