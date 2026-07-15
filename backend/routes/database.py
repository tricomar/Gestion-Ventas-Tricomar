"""
Router para gestión de base de datos (hard reset, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
from typing import Dict, List, Any
import uuid
import bcrypt
import logging

from models.users import User
from utils import db, get_current_user, require_admin

router = APIRouter(prefix="/database", tags=["database"])

logger = logging.getLogger(__name__)

# Esquema esperado de la base de datos
EXPECTED_SCHEMA = {
    'users': {
        'indexes': [
            {'key': 'email', 'unique': True},
            {'key': 'id', 'unique': True}
        ],
        'required_fields': ['id', 'email', 'password_hash', 'name', 'role', 'created_at']
    },
    'products': {
        'indexes': [
            {'key': 'id', 'unique': True},
            {'key': 'name', 'unique': False},
            {'key': 'store', 'unique': False},
            {'key': 'barcode', 'unique': False}
        ],
        'required_fields': ['id', 'name', 'cost_price', 'sale_price', 'store', 'stock', 'created_at']
    },
    'sales': {
        'indexes': [
            {'key': 'id', 'unique': True},
            {'key': 'product_id', 'unique': False},
            {'key': 'customer_id', 'unique': False},
            {'key': 'date', 'unique': False},
            {'key': 'store', 'unique': False},
            {'key': 'user_id', 'unique': False}  # Para filtrar ventas por usuario
        ],
        'required_fields': ['id', 'product_id', 'product_name', 'quantity', 'price', 'total', 'store', 'payment_method', 'user_id', 'user_name', 'created_at', 'date']
    },
    'expenses': {
        'indexes': [
            {'key': 'id', 'unique': True},
            {'key': 'date', 'unique': False},
            {'key': 'category', 'unique': False}
        ],
        'required_fields': ['id', 'description', 'amount', 'category', 'created_at']
    },
    'other_income': {
        'indexes': [
            {'key': 'id', 'unique': True},
            {'key': 'date', 'unique': False}
        ],
        'required_fields': ['id', 'description', 'amount', 'created_at']
    },
    'customers': {
        'indexes': [
            {'key': 'id', 'unique': True},
            {'key': 'name', 'unique': False},
            {'key': 'store', 'unique': False},
            {'key': 'email', 'unique': False}
        ],
        'required_fields': ['id', 'name', 'store', 'total_spent', 'purchase_count', 'created_at']
    },
    'notes': {
        'indexes': [
            {'key': 'id', 'unique': True},
            {'key': 'date', 'unique': False},
            {'key': 'author_id', 'unique': False},
            {'key': 'status', 'unique': False}
        ],
        'required_fields': ['id', 'date', 'subject', 'message', 'author_id', 'status', 'created_at']
    },
    'note_reads': {
        'indexes': [
            {'key': 'note_id', 'unique': False},
            {'key': 'user_id', 'unique': False}
        ],
        'required_fields': ['note_id', 'user_id', 'read_at']
    },
    'settings': {
        'indexes': [
            {'key': 'id', 'unique': True}
        ],
        'required_fields': ['id', 'store_a_name', 'store_b_name', 'created_at', 'updated_at']
    }
}

# ============= DATABASE MANAGEMENT =============

@router.post("/validate-and-fix")
async def validate_and_fix_schema(admin: User = Depends(require_admin)):
    """
    Valida el esquema de la base de datos y corrige automáticamente:
    - Crea colecciones faltantes
    - Crea índices faltantes
    - Inicializa documento de settings si no existe
    Solo accesible para administradores.
    """
    try:
        report = {
            "collections_checked": 0,
            "collections_created": [],
            "indexes_created": [],
            "settings_initialized": False,
            "errors": [],
            "warnings": [],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Obtener colecciones existentes
        existing_collections = set(await db.list_collection_names())
        expected_collections = set(EXPECTED_SCHEMA.keys())
        
        report["collections_checked"] = len(expected_collections)
        
        # 1. Crear colecciones faltantes y sus índices
        for collection_name, schema in EXPECTED_SCHEMA.items():
            collection_created = False
            
            # Crear colección si no existe (MongoDB las crea automáticamente al insertar)
            if collection_name not in existing_collections:
                # Forzar creación de colección
                await db.create_collection(collection_name)
                report["collections_created"].append(collection_name)
                collection_created = True
            
            # Obtener índices existentes
            collection = db[collection_name]
            existing_indexes = await collection.index_information()
            existing_index_keys = set()
            
            for idx_name, idx_info in existing_indexes.items():
                if idx_name != "_id_":  # Ignorar índice por defecto de MongoDB
                    # Extraer el nombre del campo del índice
                    key_list = idx_info.get('key', [])
                    if key_list:
                        field_name = key_list[0][0]
                        existing_index_keys.add(field_name)
            
            # Crear índices faltantes
            for index_def in schema.get('indexes', []):
                field_name = index_def['key']
                is_unique = index_def.get('unique', False)
                
                if field_name not in existing_index_keys:
                    try:
                        await collection.create_index(
                            field_name,
                            unique=is_unique,
                            background=True
                        )
                        report["indexes_created"].append({
                            "collection": collection_name,
                            "field": field_name,
                            "unique": is_unique
                        })
                    except Exception as e:
                        report["errors"].append({
                            "collection": collection_name,
                            "index": field_name,
                            "error": str(e)
                        })
        
        # 2. Verificar e inicializar documento de settings
        settings_doc = await db.settings.find_one({'id': 'settings'})
        if not settings_doc:
            default_settings = {
                "id": "settings",
                "store_a_name": "Tienda A",
                "store_b_name": "Tienda B",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.settings.insert_one(default_settings)
            report["settings_initialized"] = True
        
        # 3. Generar resumen
        total_changes = (
            len(report["collections_created"]) +
            len(report["indexes_created"]) +
            (1 if report["settings_initialized"] else 0)
        )
        
        if total_changes == 0:
            report["message"] = "✅ El esquema de la base de datos está correcto. No se requieren cambios."
            report["status"] = "ok"
        else:
            report["message"] = f"✅ Se realizaron {total_changes} correcciones en el esquema."
            report["status"] = "fixed"
        
        return report
        
    except Exception as e:
        logger.error(f"Error en validación de esquema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al validar esquema: {str(e)}"
        )

@router.post("/hard-reset")
async def hard_reset_database(password: str, current_user: User = Depends(get_current_user)):
    """
    HARD RESET de la base de datos completa.
    Solo accesible para administradores.
    Borra TODAS las colecciones y crea un usuario administrador nuevo.
    Requiere contraseña del admin actual para confirmar.
    """
    # Solo admin puede hacer esto
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden hacer hard reset de la base de datos"
        )
    
    # Validar contraseña del admin actual
    admin_user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar contraseña
    if not bcrypt.checkpw(password.encode('utf-8'), admin_user['password_hash'].encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )
    
    try:
        # 1. Obtener lista de todas las colecciones
        collections = await db.list_collection_names()
        
        # 2. Borrar TODAS las colecciones
        for collection_name in collections:
            await db[collection_name].drop()
        
        # 3. Generar credenciales para nuevo admin
        admin_email = "admin@ventas.com"
        admin_password = f"Admin{str(uuid.uuid4())[:8]}"  # Ej: Admin4f2a9b1c
        password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # 4. Crear nuevo usuario administrador
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": password_hash,
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        
        # 5. Crear documento de settings por defecto
        default_settings = {
            "id": "settings",
            "store_a_name": "Tienda A",
            "store_b_name": "Tienda B",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.settings.insert_one(default_settings)
        
        # 6. Recrear índices básicos
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.products.create_index("id", unique=True)
        await db.sales.create_index("id", unique=True)
        await db.customers.create_index("id", unique=True)
        await db.expenses.create_index("id", unique=True)
        await db.notes.create_index("id", unique=True)
        await db.settings.create_index("id", unique=True)
        
        # 7. Guardar credenciales en archivo de texto en la raíz
        credentials_file_path = "/app/ADMIN_CREDENTIALS.txt"
        timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        
        credentials_content = f"""
╔═══════════════════════════════════════════════════════════════╗
║          CREDENCIALES DE ADMINISTRADOR - HARD RESET           ║
╚═══════════════════════════════════════════════════════════════╝

⚠️  IMPORTANTE: Estas son las credenciales del super administrador
    creadas después de un Hard Reset de la base de datos.

📧 Usuario (para login):  admin
🔑 Contraseña:           {admin_password}

ℹ️  Nota: El super administrador puede iniciar sesión con "admin"
   (sin @ventas.com). Los demás usuarios deben usar email completo.

📅 Fecha de creación: {timestamp_str}

═══════════════════════════════════════════════════════════════
⚠️  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO
⚠️  Elimina este archivo después de guardar la información
═══════════════════════════════════════════════════════════════
"""
        
        with open(credentials_file_path, "w", encoding="utf-8") as f:
            f.write(credentials_content)
        
        logger.info(f"Credenciales guardadas en {credentials_file_path}")
        
        # 8. Retornar credenciales del nuevo admin
        return {
            "success": True,
            "message": "Base de datos reseteada exitosamente",
            "admin_credentials": {
                "username": "admin",
                "email": admin_email,
                "password": admin_password
            },
            "timestamp": timestamp_str
        }
        
    except Exception as e:
        logger.error(f"Error al resetear base de datos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al resetear base de datos: {str(e)}"
        )


@router.post("/soft-reset")
async def soft_reset_database(
    reset_options: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    SOFT RESET selectivo de la base de datos.
    Permite resetear colecciones específicas sin afectar el resto.
    Solo accesible para administradores.
    
    Opciones:
    - sales: bool - Resetear todas las ventas
    - users: bool - Resetear usuarios (excepto admin)
    - inventory_a: bool - Resetear inventario de Tienda A
    - inventory_b: bool - Resetear inventario de Tienda B
    - customers: bool - Resetear todos los clientes
    """
    # Solo admin puede hacer esto
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden hacer soft reset"
        )
    
    try:
        deleted_counts = {}
        
        # Resetear ventas
        if reset_options.get('sales', False):
            result = await db.sales.delete_many({})
            deleted_counts['sales'] = result.deleted_count
        
        # Resetear usuarios (excepto admin)
        if reset_options.get('users', False):
            result = await db.users.delete_many({'role': {'$ne': 'admin'}})
            deleted_counts['users'] = result.deleted_count
        
        # Resetear inventario de Tienda A
        if reset_options.get('inventory_a', False):
            result = await db.products.delete_many({'store': 'A'})
            deleted_counts['inventory_a'] = result.deleted_count
        
        # Resetear inventario de Tienda B
        if reset_options.get('inventory_b', False):
            result = await db.products.delete_many({'store': 'B'})
            deleted_counts['inventory_b'] = result.deleted_count
        
        # Resetear clientes
        if reset_options.get('customers', False):
            result = await db.customers.delete_many({})
            deleted_counts['customers'] = result.deleted_count
        
        return {
            "success": True,
            "message": "Soft reset completado exitosamente",
            "deleted_counts": deleted_counts,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error en soft reset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al hacer soft reset: {str(e)}"
        )
