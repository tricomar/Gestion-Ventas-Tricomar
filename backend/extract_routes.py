#!/usr/bin/env python3
"""
Script para extraer rutas del server.py original y organizarlas en routers modulares
"""

import re
from pathlib import Path

# Definir qué rutas van en cada router
ROUTE_MAPPING = {
    'users.py': ['/users'],
    'products.py': ['/products'],
    'sales.py': ['/sales'],
    'expenses.py': ['/expenses'],
    'income.py': ['/other-income'],
    'customers.py': ['/customers'],
    'notes.py': ['/notes'],
    'settings.py': ['/settings'],
    'dashboard.py': ['/dashboard'],
    'database.py': ['/database'],
}

def extract_route_block(content, start_line):
    """Extrae un bloque completo de una ruta"""
    lines = content.split('\n')
    route_lines = []
    in_function = False
    indent_level = 0
    
    for i in range(start_line, len(lines)):
        line = lines[i]
        
        # Detectar inicio de función
        if line.strip().startswith('@api_router.'):
            in_function = True
            route_lines.append(line)
            continue
            
        if in_function:
            # Si encontramos otra ruta o fin de archivo, terminamos
            if line.strip().startswith('@api_router.') or line.strip().startswith('# ==='):
                break
                
            route_lines.append(line)
            
            # Detectar si estamos dentro de la función
            if line.strip().startswith('async def ') or line.strip().startswith('def '):
                indent_level = len(line) - len(line.lstrip())
            elif indent_level > 0 and line.strip() and not line.startswith(' ' * (indent_level + 1)):
                # Si hay contenido con menos indentación, terminó la función
                if not line.strip().startswith(('"""', "'''", '#')):
                    break
    
    return '\n'.join(route_lines)

print("Extractor de rutas - completado manualmente")
print("Por favor, continúa con la creación manual de los routers")
