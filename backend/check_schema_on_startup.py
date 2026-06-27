#!/usr/bin/env python3
"""
Script de Validación de Esquema al Iniciar Servidor

Este script se ejecuta automáticamente al iniciar el servidor
y te alerta si hay cambios en el esquema de la base de datos.
"""

import sys
import os

# Agregar el directorio de migraciones al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'migrations'))

def check_schema():
    """
    Verifica el esquema y muestra alertas si hay cambios
    """
    try:
        from migrations.schema_validator import validate_schema
        
        print("\n" + "="*70)
        print("🔍 Verificando esquema de base de datos...")
        print("="*70)
        
        results = validate_schema()
        
        # Verificar si hay cambios importantes
        has_critical_changes = (
            results['new_collections'] or 
            results['new_fields'] or
            results['missing_fields']
        )
        
        if has_critical_changes:
            print("\n" + "⚠️ "*30)
            print("\n🔔 ¡ATENCIÓN! Se detectaron cambios en el esquema de la base de datos")
            print("\n   Por favor revisa el reporte arriba y actualiza:")
            print("   - /app/backend/migrations/schema_validator.py (EXPECTED_SCHEMA)")
            print("   - /app/SCHEMA_CHANGELOG.md")
            print("\n" + "⚠️ "*30 + "\n")
        
        return results
        
    except Exception as e:
        print(f"\n⚠️  No se pudo verificar el esquema: {str(e)}")
        print("   El servidor continuará iniciando...\n")
        return None

if __name__ == '__main__':
    check_schema()
