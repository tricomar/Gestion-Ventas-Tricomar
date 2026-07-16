"""
Script para migrar endpoints a sistema multi-tenant
Agrega filtros de account_id automáticamente
"""

import re
import os
from pathlib import Path

# Archivos a migrar
FILES_TO_MIGRATE = [
    '/app/backend/routes/products.py',
    '/app/backend/routes/customers.py',
    '/app/backend/routes/expenses.py',
    '/app/backend/routes/income.py',
    '/app/backend/routes/notes.py',
    '/app/backend/routes/dashboard.py',
    '/app/backend/routes/sales_records.py',
    '/app/backend/routes/expenses_records.py',
    '/app/backend/routes/income_records.py',
]

def add_tenant_imports(content):
    """Agrega imports de tenant si no existen"""
    if 'from middleware.tenant import' in content:
        return content  # Ya tiene los imports
    
    # Buscar la línea de imports de models
    pattern = r'(from models\.\w+ import.*?\n)'
    match = re.search(pattern, content)
    
    if match:
        # Agregar después de los imports de models
        insert_pos = match.end()
        tenant_import = 'from middleware.tenant import get_tenant_filter, add_account_id_to_document\n'
        content = content[:insert_pos] + tenant_import + content[insert_pos:]
    
    return content

def migrate_find_queries(content):
    """
    Migra queries de find/find_one para agregar tenant_filter
    """
    # Patrón 1: await db.collection.find({}, ...)
    # Reemplazar con tenant_filter
    
    # Patrón simple: db.collection.find({})
    pattern1 = r'await db\.(\w+)\.find\(\{\}'
    
    def replacer1(match):
        collection = match.group(1)
        return f'tenant_filter = get_tenant_filter(current_user.dict())\n    {match.group(0).replace("{}", "tenant_filter")}'
    
    # Buscar y reemplazar
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        # Si la línea tiene await db.X.find({})
        if 'await db.' in line and '.find({' in line:
            # Verificar si ya tiene tenant_filter en líneas anteriores
            has_filter = any('tenant_filter' in l for l in new_lines[-5:])
            
            if not has_filter and 'current_user' in line:
                # Agregar tenant_filter antes
                indent = len(line) - len(line.lstrip())
                new_lines.append(' ' * indent + '# Filtro de tenant')
                new_lines.append(' ' * indent + 'tenant_filter = get_tenant_filter(current_user.dict())')
                # Reemplazar {} con tenant_filter
                line = line.replace('.find({}, ', '.find(tenant_filter, ')
                line = line.replace('.find({})', '.find(tenant_filter)')
            elif not has_filter:
                line = line.replace('.find({}, ', '.find(tenant_filter, ')
                line = line.replace('.find({})', '.find(tenant_filter)')
        
        # find_one similar
        if 'await db.' in line and '.find_one({' in line and 'tenant_filter' not in line:
            has_filter = any('tenant_filter' in l for l in new_lines[-5:])
            
            if not has_filter and 'current_user' in line:
                indent = len(line) - len(line.lstrip())
                new_lines.append(' ' * indent + '# Filtro de tenant')
                new_lines.append(' ' * indent + 'tenant_filter = get_tenant_filter(current_user.dict())')
            
            # Reemplazar queries con ID específico
            # Ejemplo: .find_one({'id': item_id}) -> .find_one(get_tenant_filter(current_user.dict(), {'id': item_id}))
            if "{'id':" in line:
                line = re.sub(
                    r"\.find_one\(\{'id': (\w+)\}",
                    r".find_one(get_tenant_filter(current_user.dict(), {'id': \1})",
                    line
                )
            else:
                line = line.replace('.find_one({}, ', '.find_one(tenant_filter, ')
                line = line.replace('.find_one({})', '.find_one(tenant_filter)')
        
        new_lines.append(line)
    
    return '\n'.join(new_lines)

def migrate_insert_one(content):
    """
    Agrega account_id a documentos en insert_one
    """
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Si encontramos insert_one y hay un doc antes
        if 'await db.' in line and '.insert_one(' in line:
            # Buscar la variable del documento en líneas anteriores
            for j in range(i-1, max(0, i-10), -1):
                prev_line = lines[j]
                if 'doc = ' in prev_line or 'document = ' in prev_line:
                    # Verificar si ya tiene add_account_id_to_document
                    has_account_id = any('add_account_id_to_document' in l for l in lines[j:i])
                    
                    if not has_account_id:
                        # Agregar antes del insert_one
                        indent = len(line) - len(line.lstrip())
                        account_line = ' ' * indent + '# Agregar account_id (tenant isolation)'
                        
                        var_name = 'doc' if 'doc = ' in prev_line else 'document'
                        add_line = ' ' * indent + f'{var_name} = add_account_id_to_document(current_user.dict(), {var_name})'
                        
                        # Insertar antes de la línea actual
                        new_lines.insert(-1, account_line)
                        new_lines.insert(-1, add_line)
                        new_lines.insert(-1, '')
                    break
    
    return '\n'.join(new_lines)

def migrate_update_delete(content):
    """
    Migra update_one y delete_one para usar tenant_filter
    """
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        # update_one o delete_one con {'id': ...}
        if ('update_one(' in line or 'delete_one(' in line) and "{'id':" in line:
            # Reemplazar con get_tenant_filter
            if 'get_tenant_filter' not in line:
                line = re.sub(
                    r"\{'id': (\w+)\}",
                    r"get_tenant_filter(current_user.dict(), {'id': \1})",
                    line
                )
        
        new_lines.append(line)
    
    return '\n'.join(new_lines)

def migrate_file(filepath):
    """Migra un archivo completo"""
    print(f"\n📝 Migrando: {filepath}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 1. Agregar imports
        content = add_tenant_imports(content)
        
        # 2. Migrar find queries
        content = migrate_find_queries(content)
        
        # 3. Migrar insert_one
        content = migrate_insert_one(content)
        
        # 4. Migrar update/delete
        content = migrate_update_delete(content)
        
        # Si cambió algo, guardar
        if content != original_content:
            # Backup
            backup_path = filepath + '.backup'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            
            # Guardar migrado
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"  ✅ Migrado (backup en {backup_path})")
            return True
        else:
            print(f"  ℹ️  Sin cambios necesarios")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def main():
    print("🚀 Iniciando migración de endpoints a multi-tenant...")
    print(f"📁 Archivos a migrar: {len(FILES_TO_MIGRATE)}")
    
    migrated = 0
    for filepath in FILES_TO_MIGRATE:
        if os.path.exists(filepath):
            if migrate_file(filepath):
                migrated += 1
        else:
            print(f"\n⚠️  Archivo no encontrado: {filepath}")
    
    print(f"\n✅ Migración completada: {migrated}/{len(FILES_TO_MIGRATE)} archivos modificados")
    print("\n⚠️  IMPORTANTE: Revisar manualmente cada archivo migrado")
    print("   Los backups están guardados con extensión .backup")

if __name__ == "__main__":
    main()
