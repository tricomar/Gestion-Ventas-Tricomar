#!/bin/bash

# Script para monitorear sincronización de productos GrowShop
# Uso: bash /app/monitor_sync_growshop.sh

JOB_ID="f30e0d09-0a39-46b5-9f13-fddd77290f95"

echo "========================================="
echo "  MONITOR DE SINCRONIZACIÓN GROWSHOP"
echo "========================================="
echo ""

python3 -c "
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = MongoClient(os.getenv('MONGO_URL'))
db = client[os.getenv('DB_NAME')]

# Check job status
job = db.sync_jobs.find_one(
    {'id': '$JOB_ID'},
    {'_id': 0}
)

if job:
    status = job.get('status')
    progress = job.get('progress', 0)
    message = job.get('message', 'N/A')
    
    if status == 'completed':
        print('✅ SINCRONIZACIÓN COMPLETADA')
        print()
        
        # Contar productos
        gs_count = db.products.count_documents({
            'account_id': 'acc_cd0a3e485753',
            'store': 'GS'
        })
        
        with_sku = db.products.count_documents({
            'account_id': 'acc_cd0a3e485753',
            'store': 'GS',
            'sku': {'\$exists': True, '\$ne': '', '\$ne': None}
        })
        
        with_cat = db.products.count_documents({
            'account_id': 'acc_cd0a3e485753',
            'store': 'GS',
            'category': {'\$exists': True, '\$ne': '', '\$ne': None, '\$ne': 'Sin categoría'}
        })
        
        print(f'📦 Total productos GrowShop: {gs_count}')
        print(f'📦 Productos con SKU: {with_sku}')
        print(f'📁 Productos con categoría: {with_cat}')
        print()
        
        # Buscar el producto SUBBLM0050L
        product = db.products.find_one(
            {'account_id': 'acc_cd0a3e485753', 'sku': 'SUBBLM0050L'},
            {'_id': 0, 'name': 1, 'sku': 1, 'stock': 1, 'category': 1}
        )
        
        if product:
            print('✅ Producto SUBBLM0050L ENCONTRADO:')
            print(f'   Nombre: {product.get(\"name\")}')
            print(f'   SKU: {product.get(\"sku\")}')
            print(f'   Stock: {product.get(\"stock\")}')
            print(f'   Categoría: {product.get(\"category\")}')
        else:
            print('❌ Producto SUBBLM0050L aún no sincronizado')
        
    elif status == 'failed':
        print('❌ SINCRONIZACIÓN FALLÓ')
        print(f'   Error: {message}')
    elif status == 'running':
        print(f'🔄 SINCRONIZANDO... {progress}%')
        print(f'   {message}')
    else:
        print(f'⚠️ Estado: {status}')
        print(f'   {message}')
else:
    print('❌ Job no encontrado')
"

echo ""
echo "========================================="
echo "Ejecuta de nuevo este script para ver el progreso actualizado"
