"""
Router para indicadores económicos en tiempo real
Obtiene datos de findic.cl (UF, Dólar, Euro, Bitcoin, UTM, Libra Cobre)
"""

from fastapi import APIRouter
import httpx
from datetime import datetime, timedelta

router = APIRouter(tags=["indicators"])

# Cache simple para evitar consultas excesivas
indicators_cache = {
    'data': None,
    'timestamp': None
}

@router.get("/indicators")
async def get_economic_indicators():
    """
    Obtener indicadores económicos de findic.cl
    Cache de 1 hora para evitar rate limiting
    """
    # Verificar cache (1 hora)
    if (indicators_cache['data'] is not None and
        indicators_cache['timestamp'] is not None and
        datetime.now() - indicators_cache['timestamp'] < timedelta(hours=1)):
        return indicators_cache['data']
    
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            # Obtener todos los indicadores en paralelo
            indicators_config = [
                {'code': 'uf', 'name': 'UF'},
                {'code': 'dolar', 'name': 'Dólar'},
                {'code': 'euro', 'name': 'Euro'},
                {'code': 'bitcoin', 'name': 'Bitcoin'},
                {'code': 'utm', 'name': 'UTM'},
                {'code': 'libra_cobre', 'name': 'Libra Cobre'}
            ]
            
            results = []
            
            for indicator in indicators_config:
                try:
                    response = await client.get(f'https://findic.cl/api/{indicator["code"]}')
                    if response.status_code == 200:
                        data = response.json()
                        # Extraer el valor más reciente de la serie
                        if isinstance(data, dict) and 'serie' in data and len(data['serie']) > 0:
                            latest = data['serie'][0]
                            results.append({
                                'name': indicator['name'],
                                'value': latest['valor'],
                                'date': latest['fecha']
                            })
                except Exception as e:
                    print(f"Error fetching {indicator['code']}: {e}")
                    continue
            
            # Actualizar cache
            if len(results) > 0:
                indicators_cache['data'] = results
                indicators_cache['timestamp'] = datetime.now()
            
            return results if len(results) > 0 else indicators_cache.get('data', [])
            
    except Exception as e:
        print(f"Error fetching economic indicators: {e}")
        # Si hay error, devolver cache antiguo si existe
        if indicators_cache['data'] is not None:
            return indicators_cache['data']
        return []
