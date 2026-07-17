"""
Router para funcionalidades de Super-Admin
Gestión de cuentas, límites, módulos y tiendas
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
from typing import List
import uuid

from models.users import User
from models.accounts import (
    Account, UpdateAccountRequest, AddStoreRequest, 
    UpdateStoreRequest, Store, AVAILABLE_MODULES, PLANS
)
from utils import db, get_current_user
from middleware.tenant import require_super_admin

router = APIRouter(prefix="/super-admin", tags=["super-admin"])

# Endpoint público para obtener información de la cuenta del usuario
@router.get("/my-account")
async def get_my_account(current_user: User = Depends(get_current_user)):
    """
    Obtiene la información de la cuenta del usuario actual.
    Accesible para todos los usuarios autenticados.
    """
    if not current_user.account_id:
        # Super-admin sin account_id
        return {
            "id": None,
            "business_name": "Super Admin",
            "plan": "unlimited",
            "max_stores": 999,
            "max_employees": 999,
            "stores": [],
            "enabled_modules": AVAILABLE_MODULES
        }
    
    try:
        account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        return account
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener cuenta: {str(e)}"
        )

@router.get("/accounts")
async def list_accounts(current_user: User = Depends(get_current_user)):
    """
    Lista todas las cuentas del sistema.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        accounts = await db.accounts.find({}, {"_id": 0}).to_list(1000)
        return accounts
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener cuentas: {str(e)}"
        )

@router.get("/accounts/{account_id}")
async def get_account_detail(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene el detalle de una cuenta específica.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Obtener usuarios de esta cuenta
        users = await db.users.find(
            {"account_id": account_id}, 
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        
        account["users"] = users
        
        return account
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener cuenta: {str(e)}"
        )

@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    request: UpdateAccountRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Actualiza la configuración de una cuenta.
    Puede cambiar: plan, límites de tiendas/empleados, módulos habilitados, estado.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Preparar actualización
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if request.plan is not None:
            if request.plan not in PLANS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Plan inválido. Debe ser: {', '.join(PLANS.keys())}"
                )
            update_data["plan"] = request.plan
        
        if request.max_stores is not None:
            if request.max_stores < 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="max_stores debe ser al menos 1"
                )
            update_data["max_stores"] = request.max_stores
        
        if request.max_employees is not None:
            if request.max_employees < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="max_employees debe ser al menos 0"
                )
            update_data["max_employees"] = request.max_employees
        
        if request.enabled_modules is not None:
            # Validar que todos los módulos existan
            for module in request.enabled_modules:
                if module not in AVAILABLE_MODULES:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Módulo '{module}' no válido"
                    )
            update_data["enabled_modules"] = request.enabled_modules
        
        if request.status is not None:
            if request.status not in ["active", "suspended", "cancelled"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Estado debe ser: active, suspended o cancelled"
                )
            update_data["status"] = request.status
        
        # Actualizar cuenta
        await db.accounts.update_one(
            {"id": account_id},
            {"$set": update_data}
        )
        
        # Retornar cuenta actualizada
        updated_account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        return updated_account
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar cuenta: {str(e)}"
        )

@router.post("/accounts/{account_id}/stores")
async def add_store_to_account(
    account_id: str,
    request: AddStoreRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Agrega una nueva tienda a una cuenta.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Verificar límite de tiendas
        current_stores = len(account.get("stores", []))
        max_stores = account.get("max_stores", 1)
        
        if current_stores >= max_stores:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Esta cuenta ha alcanzado el límite de {max_stores} tiendas"
            )
        
        # Verificar que el código no esté duplicado
        existing_codes = [s["code"] for s in account.get("stores", [])]
        if request.code in existing_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una tienda con el código '{request.code}'"
            )
        
        # Crear nueva tienda
        new_store = {
            "id": f"store_{uuid.uuid4().hex[:8]}",
            "name": request.name,
            "code": request.code,
            "active": True
        }
        
        # Agregar a la cuenta
        await db.accounts.update_one(
            {"id": account_id},
            {
                "$push": {"stores": new_store},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        return {
            "success": True,
            "message": "Tienda agregada exitosamente",
            "store": new_store
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al agregar tienda: {str(e)}"
        )

@router.put("/accounts/{account_id}/stores/{store_id}")
async def update_store(
    account_id: str,
    store_id: str,
    request: UpdateStoreRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Actualiza el nombre de una tienda.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Buscar la tienda
        stores = account.get("stores", [])
        store_found = False
        
        for store in stores:
            if store["id"] == store_id:
                store["name"] = request.name
                store_found = True
                break
        
        if not store_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tienda no encontrada"
            )
        
        # Actualizar
        await db.accounts.update_one(
            {"id": account_id},
            {
                "$set": {
                    "stores": stores,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Tienda actualizada exitosamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar tienda: {str(e)}"
        )

@router.delete("/accounts/{account_id}/stores/{store_id}")
async def delete_store(
    account_id: str,
    store_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Elimina una tienda de una cuenta.
    Solo accesible para super-admin.
    PRECAUCIÓN: Esto puede dejar datos huérfanos.
    """
    require_super_admin(current_user.dict())
    
    try:
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Verificar que no sea la última tienda
        stores = account.get("stores", [])
        if len(stores) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede eliminar la última tienda de una cuenta"
            )
        
        # Filtrar la tienda
        new_stores = [s for s in stores if s["id"] != store_id]
        
        if len(new_stores) == len(stores):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tienda no encontrada"
            )
        
        # Actualizar
        await db.accounts.update_one(
            {"id": account_id},
            {
                "$set": {
                    "stores": new_stores,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Tienda eliminada exitosamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar tienda: {str(e)}"
        )

@router.get("/modules")
async def get_available_modules(current_user: User = Depends(get_current_user)):
    """
    Retorna la lista de módulos disponibles en el sistema.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    return {
        "modules": AVAILABLE_MODULES
    }

@router.get("/plans")
async def get_available_plans(current_user: User = Depends(get_current_user)):
    """
    Retorna la lista de planes disponibles.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    return {
        "plans": PLANS
    }

@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Elimina una cuenta y todos sus datos asociados.
    Solo accesible para super-admin.
    PRECAUCIÓN: Esta acción es irreversible.
    """
    require_super_admin(current_user.dict())
    
    try:
        # Verificar que la cuenta existe
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Eliminar todos los usuarios de la cuenta
        await db.users.delete_many({"account_id": account_id})
        
        # Eliminar datos operacionales de la cuenta
        await db.sales.delete_many({"account_id": account_id})
        await db.expenses.delete_many({"account_id": account_id})
        await db.inventory.delete_many({"account_id": account_id})
        await db.income.delete_many({"account_id": account_id})
        await db.customers.delete_many({"account_id": account_id})
        await db.notes.delete_many({"account_id": account_id})
        
        # Eliminar la cuenta
        await db.accounts.delete_one({"id": account_id})
        
        return {
            "success": True,
            "message": f"Cuenta '{account.get('business_name')}' eliminada exitosamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar cuenta: {str(e)}"
        )

@router.post("/accounts/{account_id}/users")
async def create_employee_for_account(
    account_id: str,
    user_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Crea un nuevo empleado para una cuenta específica.
    Restricciones:
    - Solo 1 Supervisor por cuenta
    - Empleados según el límite configurado (max_employees)
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        from utils.auth import hash_password
        
        # Verificar que la cuenta existe
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada"
            )
        
        # Validar datos requeridos
        if not user_data.get("name") or not user_data.get("email") or not user_data.get("password"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los campos name, email y password son requeridos"
            )
        
        role = user_data.get("role", "employee")
        
        # Validar rol
        if role not in ["supervisor", "employee"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El rol debe ser 'supervisor' o 'employee'"
            )
        
        # Si es supervisor, verificar que no exista uno ya
        if role == "supervisor":
            existing_supervisor = await db.users.find_one({
                "account_id": account_id,
                "role": "supervisor"
            }, {"_id": 0})
            
            if existing_supervisor:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Esta cuenta ya tiene un Supervisor asignado"
                )
        
        # Verificar límite de empleados (cuenta tanto supervisores como empleados)
        current_employees = await db.users.count_documents({
            "account_id": account_id,
            "role": {"$in": ["supervisor", "employee"]}
        })
        
        max_employees = account.get("max_employees", 0)
        if current_employees >= max_employees:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Esta cuenta ha alcanzado el límite de {max_employees} empleados"
            )
        
        # Verificar que el email no esté en uso
        existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado"
            )
        
        # Crear nuevo usuario
        new_user = {
            "id": str(uuid.uuid4()),
            "account_id": account_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "password_hash": hash_password(user_data["password"]),
            "role": role,
            "is_account_owner": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(new_user)
        
        # Eliminar password_hash antes de retornar
        new_user.pop("password_hash", None)
        new_user.pop("_id", None)
        
        return {
            "success": True,
            "message": "Empleado creado exitosamente",
            "user": new_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear empleado: {str(e)}"
        )

@router.put("/accounts/{account_id}/users/{user_id}")
async def update_user_info(
    account_id: str,
    user_id: str,
    user_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Actualiza la información de un usuario.
    Solo accesible para super-admin.
    """
    require_super_admin(current_user.dict())
    
    try:
        from utils.auth import hash_password
        
        # Verificar que el usuario existe y pertenece a la cuenta
        user = await db.users.find_one({"id": user_id, "account_id": account_id}, {"_id": 0})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Preparar actualización
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if "name" in user_data and user_data["name"]:
            update_data["name"] = user_data["name"]
        
        if "email" in user_data and user_data["email"]:
            # Verificar que el email no esté en uso por otro usuario
            existing = await db.users.find_one({
                "email": user_data["email"],
                "id": {"$ne": user_id}
            }, {"_id": 0})
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El email ya está en uso"
                )
            update_data["email"] = user_data["email"]
        
        if "role" in user_data and user_data["role"]:
            if user_data["role"] not in ["account_admin", "supervisor", "employee"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Rol inválido"
                )
            update_data["role"] = user_data["role"]
        
        if "password" in user_data and user_data["password"]:
            update_data["password_hash"] = hash_password(user_data["password"])
        
        # Actualizar usuario
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        # Retornar usuario actualizado sin password
        updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        
        return {
            "success": True,
            "message": "Usuario actualizado exitosamente",
            "user": updated_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar usuario: {str(e)}"
        )
