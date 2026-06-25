# Configuración de Limpieza Automática del Sidebar

## Contexto

El DailySidebar muestra los registros del día actual. El usuario solicitó que este se vacíe automáticamente a las 00:00 hrs, moviendo las ventas del día a los datos históricos.

## Comportamiento Actual (Automático)

**NOTA IMPORTANTE**: El sidebar **ya se vacía automáticamente** sin necesidad de configuración adicional.

### ¿Cómo funciona?

El componente `DailySidebar` obtiene sus datos del endpoint:
```
GET /api/dashboard/daily-records
```

Este endpoint filtra los registros por fecha:
```python
today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
tomorrow_start = today_start + timedelta(days=1)

sales = db.sales.find({
    'created_at': {'$gte': today_start.isoformat(), '$lt': tomorrow_start.isoformat()}
})
```

**Resultado**: Cuando el reloj marca las 00:00 y cambia de día:
- Los registros del día anterior ya no cumplen el filtro de fecha
- El sidebar se muestra vacío automáticamente
- Los datos "antiguos" permanecen en la base de datos y son accesibles desde "Histórico"

### Datos No Se Eliminan

Los registros NO se eliminan de la base de datos. Simplemente:
1. Dejan de mostrarse en el DailySidebar (porque son de días anteriores)
2. Quedan disponibles en la sección "Histórico" (botón en Métricas en Tiempo Real)
3. Se pueden consultar en la página de Reportes

## Verificación del Comportamiento

Para verificar que funciona correctamente:

```bash
# 1. Registrar una venta hoy
# 2. Verificar que aparece en el sidebar
# 3. Esperar a las 00:00 (cambio de día)
# 4. Recargar la página
# 5. El sidebar debe estar vacío (solo muestra "$0" en los totales)
# 6. Ir a "Histórico" y buscar el mes anterior
# 7. Los datos siguen ahí
```

## Configuración Adicional (Opcional)

Si deseas implementar una tarea programada adicional para realizar acciones a las 00:00 (como enviar reportes por email, hacer backups, etc.), puedes usar cron:

### En el Servidor VPS (Ubuntu)

1. Editar crontab:
```bash
sudo crontab -e
```

2. Agregar tarea (ejemplo: generar reporte diario):
```bash
# Generar reporte diario a las 00:01
1 0 * * * /usr/bin/python3 /var/www/ventas-app/backend/scripts/daily_report.py
```

### Ejemplo de Script de Reporte Diario

Crear `/var/www/ventas-app/backend/scripts/daily_report.py`:

```python
#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone

async def generate_daily_report():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['ventas_db']
    
    # Calcular rango del día anterior
    now = datetime.now(timezone.utc)
    yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_end = yesterday_start + timedelta(days=1)
    
    # Obtener ventas del día anterior
    sales = await db.sales.find({
        'created_at': {
            '$gte': yesterday_start.isoformat(),
            '$lt': yesterday_end.isoformat()
        }
    }).to_list(10000)
    
    # Calcular totales
    total_sales = sum(s.get('total', 0) for s in sales)
    total_cost = sum(s.get('cost_price', 0) * s.get('quantity', 0) for s in sales)
    profit = (total_sales * 0.81) - total_cost
    
    # Imprimir reporte (o enviar por email)
    print(f"=== Reporte Diario {yesterday_start.strftime('%Y-%m-%d')} ===")
    print(f"Total Ventas: ${total_sales:,.0f}")
    print(f"Total Costo: ${total_cost:,.0f}")
    print(f"Ganancia Neta: ${profit:,.0f}")
    print(f"Número de transacciones: {len(sales)}")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(generate_daily_report())
```

Hacer ejecutable:
```bash
chmod +x /var/www/ventas-app/backend/scripts/daily_report.py
```

## Resumen

✅ **El sidebar ya se vacía automáticamente** - No requiere configuración
✅ **Los datos se preservan** - Accesibles desde Histórico
✅ **Funciona por diseño del sistema** - Basado en filtros de fecha

Si necesitas funcionalidades adicionales a las 00:00 (emails, notificaciones, etc.), puedes usar cron como se describe arriba.
