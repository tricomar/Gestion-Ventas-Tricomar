# 🕐 Corrección de Zona Horaria - Chile (America/Santiago)

## 📋 Problema Identificado

Las ventas ingresadas el día 14 de julio después de las 20:00 hrs (hora de Chile) aparecían como ventas del día 15 de julio y persistían en el sidebar "Registros del Día" incluso después de medianoche.

### Causa Raíz

1. **Servidor en UTC**: El servidor guarda timestamps en UTC (`datetime.now(timezone.utc)`)
2. **Sin conversión de zona horaria**: Los filtros de fecha no consideraban la diferencia horaria
3. **Ejemplo del problema**:
   - Venta ingresada: 14 julio, 22:00 Chile (UTC-4)
   - Guardada como: 15 julio, 02:00 UTC
   - Al día siguiente (15 julio), la venta del 14 aparecía en el sidebar del 15

## ✅ Solución Implementada

### 1. Uso de `zoneinfo` (Python 3.9+)

Se agregó soporte para la zona horaria de Chile en todos los endpoints relevantes:

```python
from zoneinfo import ZoneInfo

CHILE_TZ = ZoneInfo('America/Santiago')
```

### 2. Archivos Modificados

#### `/app/backend/routes/sales.py`
- **GET `/api/sales`**: Filtra ventas por día considerando hora de Chile
- **POST `/api/sales`**: Guarda campo `date` en formato YYYY-MM-DD (fecha Chile)
- **POST `/api/sales/past`**: Maneja fechas pasadas en zona horaria de Chile

#### `/app/backend/routes/expenses.py`
- **GET `/api/expenses`**: Filtra gastos por día en hora Chile

#### `/app/backend/routes/income.py`
- **GET `/api/other-income`**: Filtra otros ingresos por día en hora Chile

#### `/app/backend/routes/dashboard.py`
- **GET `/api/dashboard/realtime-metrics`**: Calcula métricas del día y mes actual en hora Chile

### 3. Lógica de Conversión

#### Al guardar una venta nueva:
```python
# Obtener hora actual de Chile
chile_time = datetime.now(CHILE_TZ)

# Guardar fecha local (sin hora) como string
doc['date'] = chile_time.strftime('%Y-%m-%d')  # Ej: "2026-07-15"

# El created_at se guarda en UTC (timestamp exacto)
doc['created_at'] = datetime.now(timezone.utc).isoformat()
```

#### Al filtrar ventas del día:
```python
# Ejemplo: filtrar ventas del 15 de julio
date_str = '2026-07-15'

# Crear inicio y fin del día en hora Chile
target_date = datetime.fromisoformat(date_str)
chile_start = target_date.replace(hour=0, minute=0, second=0, tzinfo=CHILE_TZ)
chile_end = chile_start + timedelta(days=1)

# Convertir a UTC para consultar la base de datos
utc_start = chile_start.astimezone(timezone.utc)  # 2026-07-15 04:00:00 UTC
utc_end = chile_end.astimezone(timezone.utc)      # 2026-07-16 04:00:00 UTC

# Query MongoDB
query = {
    'created_at': {
        '$gte': utc_start.isoformat(),
        '$lt': utc_end.isoformat()
    }
}
```

## 🔍 Verificación

### Prueba Manual

1. **Crear una venta a las 23:00 hrs (Chile)**:
   ```bash
   # La venta debe aparecer en el día actual (no el siguiente)
   # El campo 'date' debe guardar la fecha Chile correcta
   ```

2. **Esperar hasta después de medianoche (00:01 Chile)**:
   ```bash
   # El sidebar "Registros del Día" debe limpiarse automáticamente
   # Las ventas del día anterior NO deben aparecer
   ```

3. **Verificar en base de datos**:
   ```python
   # La venta tiene:
   # - created_at: timestamp UTC
   # - date: fecha local Chile (YYYY-MM-DD)
   ```

### Ejemplo de Venta Guardada

```json
{
  "id": "93ae2e48-a544-42f0-b96c-e3f4d7f1460e",
  "created_at": "2026-07-15T07:32:15.145796+00:00",  // UTC
  "date": "2026-07-15",                               // Chile local date
  "product_name": "Producto Test TZ",
  "total": 10000,
  ...
}
```

## 📊 Zona Horaria de Chile

- **Invierno (abril - septiembre)**: UTC-4
- **Verano (octubre - marzo)**: UTC-3 (horario de verano)
- El sistema usa `ZoneInfo('America/Santiago')` que maneja automáticamente el cambio de horario

## ⚠️ Notas Importantes

1. **No modificar timestamps UTC**: El campo `created_at` siempre se guarda en UTC para consistencia
2. **Usar `date` para filtros**: El campo `date` (string YYYY-MM-DD) representa el día local
3. **Frontend sigue usando fecha local**: El navegador del usuario determina qué día solicita al backend
4. **Backward compatible**: Las ventas antiguas sin campo `date` seguirán funcionando (se filtran por `created_at`)

## 🚀 Beneficios

✅ Las ventas se asocian al día correcto según la hora de Chile
✅ El sidebar se limpia automáticamente al cambiar de día
✅ Los reportes y métricas reflejan el día real de Chile
✅ Compatible con cambios de horario de verano/invierno automáticamente

---

**Fecha de implementación**: 15 de julio, 2026  
**Desarrollado por**: Emergent AI Agent  
