import asyncio
import sys
sys.path.insert(0, '/app/backend')

from services.prestashop_service import PrestashopAPIService
from database import db

async def test_limits():
    # Obtener credenciales de la integración
    integration = await db.integrations.find_one(
        {'id': '38b5bca6-0fe7-439d-bc97-5987d27b34a0'},
        {'_id': 0}
    )
    
    ps = PrestashopAPIService(
        api_url=integration['shop_url'] + '/api',
        api_key=integration['api_key']
    )
    
    # Probar diferentes límites
    limits = [500, 750, 1000, 1500, 2000, 2500]
    
    print("=== Probando límites de PrestaShop ===\n")
    
    for limit in limits:
        try:
            print(f"Probando limit={limit}...", end=" ", flush=True)
            products = ps.get_products(limit=limit, offset=0)
            print(f"✓ OK - Obtenidos {len(products)} productos")
            
            if len(products) < limit:
                print(f"  → Límite real alcanzado: {len(products)} productos disponibles")
                break
                
        except Exception as e:
            error_msg = str(e)[:100]
            print(f"✗ FALLA - {error_msg}")
            if limit > 500:
                print(f"  → Límite máximo funcional: {limits[limits.index(limit)-1]}")
            break
    
    print("\n=== Prueba completada ===")

if __name__ == "__main__":
    asyncio.run(test_limits())
