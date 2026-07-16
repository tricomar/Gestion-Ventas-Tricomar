"""
Router para gestión de base de datos (hard reset, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends, status, Body
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import uuid
import bcrypt
import logging

from models.users import User
from utils import db, get_current_user, require_admin
from middleware.tenant import get_account_id_from_user

router = APIRouter(prefix="/database", tags=["database"])

logger = logging.getLogger(__name__)

# Modelos de request
class HardResetRequest(BaseModel):
    password: str  # Contraseña actual para validar
    new_password: str  # Nueva contraseña a asignar
    account_id: Optional[str] = None  # Para super-admin especificar cuenta

class SoftResetRequest(BaseModel):
    password: str  # Contraseña actual para validar
    account_id: Optional[str] = None  # Para super-admin especificar cuenta
    sales: bool = False
    users: bool = False
    inventory_a: bool = False
    inventory_b: bool = False
    customers: bool = False

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
async def hard_reset_database(
    request: HardResetRequest,
    current_user: User = Depends(get_current_user)
):
    """
    HARD RESET de base de datos de una cuenta específica.
    - Account_admin: Resetea su propia cuenta
    - Super-admin: Debe especificar account_id para resetear cualquier cuenta
    
    ELIMINA TODOS LOS DATOS de la cuenta y actualiza contraseña del admin.
    """
    # Determinar qué cuenta resetear
    target_account_id = request.account_id
    
    # Si no es super-admin, solo puede resetear su propia cuenta
    if current_user.role != 'super_admin':
        if target_account_id and target_account_id != current_user.account_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para resetear otras cuentas"
            )
        target_account_id = current_user.account_id
        
        if not target_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo determinar la cuenta a resetear"
            )
    
    # Si es super-admin y no especificó account_id, error
    if current_user.role == 'super_admin' and not target_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super-admin debe especificar account_id de la cuenta a resetear"
        )
    
    # Buscar el admin owner de la cuenta target
    admin_user = await db.users.find_one({
        "account_id": target_account_id,
        "is_account_owner": True
    }, {"_id": 0})
    
    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    # Verificar contraseña del usuario actual
    current_user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not bcrypt.checkpw(request.password.encode('utf-8'), current_user_doc['password_hash'].encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )
    
    # Validar nueva contraseña
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 8 caracteres"
        )
    
    try:
        # Hash de la nueva contraseña
        new_password_hash = bcrypt.hashpw(
            request.new_password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        # Buscar cuenta para obtener info
        account = await db.accounts.find_one({"id": target_account_id}, {"_id": 0})
        if not account:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
        # ELIMINAR TODOS LOS DATOS DE LA CUENTA
        await db.sales.delete_many({"account_id": target_account_id})
        await db.products.delete_many({"account_id": target_account_id})
        await db.expenses.delete_many({"account_id": target_account_id})
        await db.other_income.delete_many({"account_id": target_account_id})
        await db.customers.delete_many({"account_id": target_account_id})
        await db.notes.delete_many({"account_id": target_account_id})
        
        # Eliminar empleados (no el owner)
        await db.users.delete_many({
            "account_id": target_account_id,
            "is_account_owner": False
        })
        
        # Actualizar contraseña del admin owner
        await db.users.update_one(
            {"id": admin_user["id"]},
            {"$set": {"password_hash": new_password_hash}}
        )
        
        # Resetear contador de empleados
        await db.accounts.update_one(
            {"id": target_account_id},
            {"$set": {
                "current_employees": 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Recrear índices
        await db.sales.create_index("id", unique=True)
        await db.products.create_index("id", unique=True)
        await db.expenses.create_index("id", unique=True)
        await db.notes.create_index("id", unique=True)
        
        return {
            "success": True,
            "message": f"Cuenta '{account['business_name']}' reseteada exitosamente",
            "admin_credentials": {
                "email": admin_user["email"],
                "password": request.new_password
            },
            "account_id": target_account_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error al resetear base de datos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al resetear base de datos: {str(e)}"
        )


@router.post("/soft-reset")
async def soft_reset_database(
    request: SoftResetRequest,
    current_user: User = Depends(get_current_user)
):
    """
    SOFT RESET selectivo de base de datos de una cuenta.
    - Account_admin: Resetea elementos de su propia cuenta
    - Super-admin: Debe especificar account_id
    
    Opciones: sales, users, inventory_a, inventory_b, customers
    """
    # Determinar qué cuenta resetear
    target_account_id = request.account_id
    
    # Si no es super-admin, solo puede resetear su propia cuenta
    if current_user.role != 'super_admin':
        if target_account_id and target_account_id != current_user.account_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para resetear otras cuentas"
            )
        target_account_id = current_user.account_id
        
        if not target_account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo determinar la cuenta"
            )
    
    # Si es super-admin y no especificó account_id, error
    if current_user.role == 'super_admin' and not target_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super-admin debe especificar account_id"
        )
    
    # Verificar contraseña del usuario actual
    current_user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not bcrypt.checkpw(request.password.encode('utf-8'), current_user_doc['password_hash'].encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta"
        )
    
    # Verificar que al menos una opción esté seleccionada
    has_selection = any([
        request.sales,
        request.users,
        request.inventory_a,
        request.inventory_b,
        request.customers
    ])
    
    if not has_selection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes seleccionar al menos una opción para resetear"
        )
    
    try:
        deleted_counts = {}
        
        # Resetear ventas
        if request.sales:
            result = await db.sales.delete_many({"account_id": target_account_id})
            deleted_counts['sales'] = result.deleted_count
        
        # Resetear usuarios (excepto el owner)
        if request.users:
            result = await db.users.delete_many({
                "account_id": target_account_id,
                "is_account_owner": False
            })
            deleted_counts['users'] = result.deleted_count
            
            # Actualizar contador en account
            await db.accounts.update_one(
                {"id": target_account_id},
                {"$set": {"current_employees": 0}}
            )
        
        # Resetear inventario Tienda A
        if request.inventory_a:
            result = await db.products.delete_many({
                "account_id": target_account_id,
                "store": "A"
            })
            deleted_counts['inventory_a'] = result.deleted_count
        
        # Resetear inventario Tienda B
        if request.inventory_b:
            result = await db.products.delete_many({
                "account_id": target_account_id,
                "store": "B"
            })
            deleted_counts['inventory_b'] = result.deleted_count
        
        # Resetear clientes
        if request.customers:
            result = await db.customers.delete_many({"account_id": target_account_id})
            deleted_counts['customers'] = result.deleted_count
        
        return {
            "success": True,
            "message": "Soft reset completado",
            "deleted_counts": deleted_counts,
            "account_id": target_account_id
        }
        
        return {
            "success": True,
            "message": "Soft reset completado",
            "deleted_counts": deleted_counts,
            "account_id": target_account_id
        }
        
    except Exception as e:
        logger.error(f"Error en soft reset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al hacer soft reset: {str(e)}"
        )
