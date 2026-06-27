#!/usr/bin/env python3
"""
Generador de Archivos de Migración

Uso: python create_migration.py "descripcion_del_cambio"
"""

import sys
import os
from datetime import datetime

def create_migration(description: str):
    """Crea un nuevo archivo de migración"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"migration_{timestamp}_{description.lower().replace(' ', '_')}.py"
    filepath = os.path.join('/app/backend/migrations', filename)
    
    # Construir el contenido del template
    migration_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    template_lines = [
        '#!/usr/bin/env python3',
        '"""',
        f'Migración: {description}',
        '',
        f'Fecha: {migration_date}',
        '"""',
        '',
        'from pymongo import MongoClient',
        'from datetime import datetime',
        'import os',
        'from dotenv import load_dotenv',
        '',
        "load_dotenv('/app/backend/.env')",
        '',
        "MONGO_URL = os.environ.get('MONGO_URL')",
        "DB_NAME = os.environ.get('DB_NAME', 'sales_management')",
        '',
        'def up():',
        '    """',
        '    Aplica los cambios de esta migración',
        '    """',
        '    client = MongoClient(MONGO_URL)',
        '    db = client[DB_NAME]',
        '    ',
        '    try:',
        '        # TODO: Implementa tus cambios aquí',
        '        # Ejemplo:',
        "        # db.nueva_coleccion.create_index('campo')",
        '        # db.coleccion_existente.update_many({}, {"$set": {"nuevo_campo": "valor_default"}})',
        '        ',
        f'        print("✅ Migración \'{description}\' aplicada exitosamente")',
        '        ',
        '        # Registrar migración',
        '        db.migrations.insert_one({',
        f"            'name': '{filename}',",
        "            'applied_at': datetime.now().isoformat(),",
        f"            'description': '{description}'",
        '        })',
        '        ',
        '    except Exception as e:',
        '        print(f"❌ Error aplicando migración: {str(e)}")',
        '        raise',
        '    finally:',
        '        client.close()',
        '',
        'def down():',
        '    """',
        '    Revierte los cambios de esta migración (opcional)',
        '    """',
        '    client = MongoClient(MONGO_URL)',
        '    db = client[DB_NAME]',
        '    ',
        '    try:',
        '        # TODO: Implementa la reversión aquí',
        f'        print("✅ Migración \'{description}\' revertida")',
        '    except Exception as e:',
        '        print(f"❌ Error revirtiendo migración: {str(e)}")',
        '        raise',
        '    finally:',
        '        client.close()',
        '',
        "if __name__ == '__main__':",
        '    up()',
        ''
    ]
    
    template = '\n'.join(template_lines)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(template)
    
    # Make executable
    os.chmod(filepath, 0o755)
    
    print(f"\n✅ Migración creada: {filename}")
    print(f"📂 Ubicación: {filepath}")
    print(f"\n📝 Próximos pasos:")
    print(f"   1. Edita el archivo y completa la función up()")
    print(f"   2. Ejecuta: python {filepath}")
    print(f"   3. Actualiza SCHEMA_CHANGELOG.md\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("\n❌ Error: Debes proporcionar una descripción")
        print("\nUso: python create_migration.py \"descripcion_del_cambio\"")
        print("\nEjemplo: python create_migration.py \"agregar_campo_telefono_a_clientes\"\n")
        sys.exit(1)
    
    description = sys.argv[1]
    create_migration(description)
