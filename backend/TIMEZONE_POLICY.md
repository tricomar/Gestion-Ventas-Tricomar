# Política de Manejo de Timestamps - Negocio Feliz

## Objetivo
Asegurar que todos los datos de negocio (ventas, gastos, ingresos) se agrupan y visualizan correctamente según la zona horaria configurada por la cuenta.

## Política General

### 1. Almacenamiento en MongoDB
- **Todos los timestamps se almacenan como strings ISO en UTC**
- Formato: `"2026-08-06T20:00:00.000Z"`
- Campo estándar: `created_at`
- Nunca almacenar timestamps en timezone local

### 2. Creación de Registros
Al crear una venta, gasto o ingreso:
```python
from utils.timezone_utils import now_utc, to_utc_iso

# Correcto:
sale = {
    "created_at": to_utc_iso(now_utc()),
    "account_id": account_id,
    # ... otros campos
}
```

### 3. Consultas por Fecha
Para obtener registros de un día específico en hora local:

```python
from utils.timezone_utils import get_day_boundaries_utc, get_account_timezone

# Obtener timezone de la cuenta
tz = await get_account_timezone(account_id)  # "America/Santiago"

# Obtener límites UTC para el día local
start_utc, end_utc = get_day_boundaries_utc("2026-08-06", tz)

# Query MongoDB
sales = await db.sales.find({
    "account_id": account_id,
    "created_at": {"$gte": start_utc, "$lte": end_utc}
}).to_list(1000)
```

### 4. Consultas por Mes
Para obtener registros de un mes específico:

```python
from utils.timezone_utils import get_month_boundaries_utc

start_utc, end_utc = get_month_boundaries_utc(2026, 8, tz)

sales = await db.sales.find({
    "account_id": account_id,
    "created_at": {"$gte": start_utc, "$lte": end_utc}
}).to_list(1000)
```

### 5. Visualización en Frontend
Siempre convertir a hora local antes de mostrar:

```python
from utils.timezone_utils import format_datetime_local

# Backend API response
sale_response = {
    "sale_id": sale["sale_id"],
    "total": sale["total"],
    "created_at": sale["created_at"],  # UTC string
    "created_at_local": format_datetime_local(sale["created_at"], tz)
}
```

## Casos de Uso Específicos

### Dashboard - Ventas del Día
```python
from datetime import datetime
from utils.timezone_utils import now_local, get_day_boundaries_utc

# Obtener fecha local actual
local_now = now_local(tz)
today_str = local_now.strftime("%Y-%m-%d")

# Límites UTC para hoy (local)
start_utc, end_utc = get_day_boundaries_utc(today_str, tz)

# Query
today_sales = await db.sales.find({
    "account_id": account_id,
    "created_at": {"$gte": start_utc, "$lte": end_utc}
}).to_list(1000)

total_today = sum(s["total"] for s in today_sales)
```

### Reportes - Agrupación por Fecha Local
Para reportes que agrupan por fecha, se debe:
1. Obtener todos los registros del rango
2. Convertir cada timestamp a fecha local
3. Agrupar por fecha local en Python (no en MongoDB)

```python
from utils.timezone_utils import to_local_date
from collections import defaultdict

# Obtener registros del mes
start_utc, end_utc = get_month_boundaries_utc(2026, 8, tz)
sales = await db.sales.find({
    "account_id": account_id,
    "created_at": {"$gte": start_utc, "$lte": end_utc}
}).to_list(10000)

# Agrupar por fecha local
sales_by_date = defaultdict(list)
for sale in sales:
    local_date = to_local_date(sale["created_at"], tz)
    sales_by_date[local_date].append(sale)

# Calcular totales por día
daily_totals = {
    date: sum(s["total"] for s in sales)
    for date, sales in sales_by_date.items()
}
```

## Migración de Datos Existentes

### Problema Actual
Los timestamps en la base de datos tienen formatos inconsistentes:
- `"2026-08-06T20:00:00-04:00"` (con offset)
- `"2026-08-06T14:30:18.030Z"` (UTC con Z)
- `"2026-08-03T07:40:05.190923+00:00"` (UTC con +00:00)

### Solución
Normalizar todos a formato UTC con Z:

```python
from utils.timezone_utils import parse_datetime, to_utc_iso

def normalize_timestamp(timestamp_str: str) -> str:
    """Normalizar timestamp a formato UTC estándar"""
    dt = parse_datetime(timestamp_str)
    if dt:
        return to_utc_iso(dt)
    return timestamp_str  # Si no se puede parsear, mantener original

# Script de migración
async def migrate_timestamps():
    # Sales
    sales = await db.sales.find({"account_id": account_id}).to_list(10000)
    for sale in sales:
        if sale.get("created_at"):
            normalized = normalize_timestamp(sale["created_at"])
            await db.sales.update_one(
                {"_id": sale["_id"]},
                {"$set": {"created_at": normalized}}
            )
    
    # Repetir para expenses, income, ecommerce_orders
```

## Campo "date" Obsoleto
El campo `date` (string YYYY-MM-DD) es redundante y puede causar inconsistencias.

**Acción recomendada:**
- No crear campo `date` en nuevos registros
- Para filtros, usar siempre `created_at` con boundaries UTC
- Eliminar campo `date` en futura limpieza de datos

## Validación
Para verificar que la implementación es correcta:

1. Crear venta a las 23:30 hora local
2. Verificar que aparece en el día correcto del Dashboard
3. Cambiar timezone de cuenta
4. Verificar que las ventas se agrupan correctamente en el nuevo timezone

## Casos Edge
- **Cambio de horario de verano/invierno**: ZoneInfo lo maneja automáticamente
- **Timezone inválido**: Función `get_account_timezone` retorna default "America/Santiago"
- **Timestamp None/vacío**: Funciones retornan None o string vacío, no fallan
