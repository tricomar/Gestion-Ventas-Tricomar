"""
Router para gestión de base de datos (hard reset, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
import uuid
import bcrypt
import logging

from models.users import User
from utils import db, get_current_user, require_admin

router = APIRouter(prefix="/database", tags=["database"])

logger = logging.getLogger(__name__)

# ============= DATABASE MANAGEMENT =============

@router.post("/database/hard-reset")
async def hard_reset_database(current_user: User = Depends(get_current_user)):
    """
    HARD RESET de la base de datos completa.
    Solo accesible para administradores.
    Borra TODAS las colecciones y crea un usuario administrador nuevo.
    """
    # Solo admin puede hacer esto
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden hacer hard reset de la base de datos"
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
        
        # 7. Retornar credenciales del nuevo admin
        return {
            "success": True,
            "message": "Base de datos reseteada exitosamente",
            "admin_credentials": {
                "email": admin_email,
                "password": admin_password,
                "warning": "GUARDA ESTAS CREDENCIALES - No se volverán a mostrar"
            },
            "collections_deleted": len(collections),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error en hard reset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al resetear base de datos: {str(e)}"
        )
