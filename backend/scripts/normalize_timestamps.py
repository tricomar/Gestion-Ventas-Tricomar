"""
Script para normalizar timestamps en MongoDB

Este script convierte todos los timestamps existentes al formato estándar UTC ISO.
Formato objetivo: "2026-08-06T14:30:18.030Z"

Colecciones a normalizar:
- sales (campo: created_at)
- expenses (campo: created_at)
- income (campo: created_at)
- ecommerce_orders (campos: created_at, date_add, date_upd)
"""

import os
import sys
sys.path.insert(0, '/app/backend')

from pymongo import MongoClient
from dotenv import load_dotenv
from utils.timezone_utils import parse_datetime, to_utc_iso

load_dotenv('/app/backend/.env')


def normalize_timestamp(timestamp_str):
    """Normalizar timestamp a formato UTC estándar"""
    if not timestamp_str:
        return None
    
    dt = parse_datetime(timestamp_str)
    if dt:
        return to_utc_iso(dt)
    
    return timestamp_str  # Si no se puede parsear, mantener original


def dry_run_collection(db, collection_name, field_name, account_id):
    """
    Simular normalización sin modificar datos
    """
    collection = db[collection_name]
    
    print(f"\n{'='*60}")
    print(f"📋 {collection_name.upper()} - Campo: {field_name}")
    print(f"{'='*60}")
    
    # Contar documentos
    total_docs = collection.count_documents({"account_id": account_id})
    print(f"Total documentos: {total_docs}")
    
    if total_docs == 0:
        print("⚠️  Colección vacía, omitiendo...")
        return None
    
    # Obtener muestra
    docs = list(collection.find({"account_id": account_id}).limit(5))
    
    changes = 0
    unchanged = 0
    errors = 0
    
    print(f"\nMuestra de {len(docs)} documentos:")
    
    for i, doc in enumerate(docs, 1):
        original = doc.get(field_name)
        
        if not original:
            print(f"\n  Doc {i}: ⚠️  Sin campo '{field_name}'")
            continue
        
        normalized = normalize_timestamp(original)
        
        if normalized == original:
            unchanged += 1
            status = "✅ OK"
        elif normalized:
            changes += 1
            status = "🔄 CAMBIO"
        else:
            errors += 1
            status = "❌ ERROR"
        
        print(f"\n  Doc {i}: {status}")
        print(f"    Original:   {original}")
        if normalized != original:
            print(f"    Normalized: {normalized}")
    
    print(f"\n📊 Resumen:")
    print(f"   ✅ Ya normalizados: {unchanged}")
    print(f"   🔄 Requieren cambio: {changes}")
    print(f"   ❌ Errores: {errors}")
    
    return {
        "collection": collection_name,
        "field": field_name,
        "total": total_docs,
        "changes_needed": changes,
        "errors": errors
    }


def normalize_collection(db, collection_name, field_name, account_id, dry_run=True):
    """
    Normalizar timestamps en una colección
    
    Args:
        db: Database object
        collection_name: Nombre de la colección
        field_name: Nombre del campo timestamp
        account_id: ID de la cuenta
        dry_run: Si True, solo simula sin modificar
    """
    collection = db[collection_name]
    
    if dry_run:
        return dry_run_collection(db, collection_name, field_name, account_id)
    
    # Normalización real
    print(f"\n🔧 Normalizando {collection_name}.{field_name}...")
    
    docs = list(collection.find({"account_id": account_id}))
    
    updated = 0
    for doc in docs:
        original = doc.get(field_name)
        if not original:
            continue
        
        normalized = normalize_timestamp(original)
        
        if normalized and normalized != original:
            collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {field_name: normalized}}
            )
            updated += 1
    
    print(f"   ✅ {updated} documentos actualizados")
    
    return {
        "collection": collection_name,
        "field": field_name,
        "updated": updated
    }


def main():
    client = MongoClient(os.getenv('MONGO_URL'))
    db_name = os.getenv('DB_NAME', 'test_database')
    db = client[db_name]
    
    account_id = "acc_cd0a3e485753"  # Tricomar account
    
    print("=" * 60)
    print("🔧 NORMALIZACIÓN DE TIMESTAMPS")
    print("=" * 60)
    print(f"\nBase de datos: {db_name}")
    print(f"Cuenta: {account_id}")
    print(f"\nModo: NORMALIZACIÓN REAL (modificando datos)")
    print(f"⚠️  Los timestamps serán modificados")
    
    # Colecciones y campos a normalizar
    collections = [
        ("sales", "created_at"),
        ("expenses", "created_at"),
        ("income", "created_at"),
        ("ecommerce_orders", "created_at"),
    ]
    
    results = []
    
    for coll_name, field in collections:
        result = normalize_collection(db, coll_name, field, account_id, dry_run=False)
        if result:
            results.append(result)
    
    # Resumen final
    print(f"\n{'='*60}")
    print("📊 RESUMEN FINAL")
    print(f"{'='*60}")
    
    total_updated = sum(r.get("updated", 0) for r in results if r)
    
    print(f"\n✅ Total documentos actualizados: {total_updated}")
    print(f"✅ Normalización completada exitosamente")
    
    client.close()


if __name__ == "__main__":
    main()
