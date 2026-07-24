"""
Router de autenticación
Maneja registro, login y actualización de perfil
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
import bcrypt
import uuid

from models.users import User, UserCreate, UserLogin, TokenResponse
from models.accounts import PLANS
from utils import db, hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(user_input: UserCreate):
    """
    Registrar un nuevo usuario y crear cuenta freemium automáticamente.
    Cada usuario que se registra crea su propia cuenta independiente.
    """
    # Verificar si el usuario ya existe
    existing = await db.users.find_one({'email': user_input.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    
    try:
        # Crear ID de cuenta
        account_id = f"acc_{uuid.uuid4().hex[:12]}"
        
        # Crear cuenta freemium
        business_name = user_input.business_name or f"Negocio de {user_input.name}"
        
        account = {
            "id": account_id,
            "owner_user_id": "",  # Se actualizará después de crear el usuario
            "business_name": business_name,
            "plan": "free",
            "max_stores": 1,
            "max_employees": 0,
            "current_employees": 0,
            "stores": [
                {
                    "id": f"store_{uuid.uuid4().hex[:8]}",
                    "name": "Primera Tienda",
                    "code": "PT"
                }
            ],
            "enabled_modules": ["sales"],  # Solo ventas en plan free
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Crear usuario (owner de la cuenta)
        user_id = str(uuid.uuid4())
        user_dict = {
            "id": user_id,
            "account_id": account_id,
            "email": user_input.email,
            "password_hash": hash_password(user_input.password),
            "name": user_input.name,
            "role": "account_admin",
            "is_account_owner": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Actualizar owner_user_id en cuenta
        account["owner_user_id"] = user_id
        
        # Insertar en base de datos
        await db.accounts.insert_one(account)
        await db.users.insert_one(user_dict)
        
        # Crear objeto User para respuesta (sin password_hash)
        user = User(
            id=user_id,
            account_id=account_id,
            email=user_input.email,
            name=user_input.name,
            role="account_admin",
            is_account_owner=True,
            created_at=datetime.now(timezone.utc)
        )
        
        # Generar token
        token = create_token(user.id, user.email)
        
        return TokenResponse(token=token, user=user)
        
    except Exception as e:
        # Rollback si algo falla
        await db.accounts.delete_one({"id": account_id})
        await db.users.delete_one({"id": user_id})
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear cuenta: {str(e)}"
        )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Iniciar sesión
    - Super-admin puede usar "admin" o su email completo
    - Otros usuarios deben usar su email completo
    """
    # Permitir login con "admin" para buscar al super-admin
    if credentials.email == "admin":
        # Buscar super-admin por rol
        user_doc = await db.users.find_one(
            {"role": "super_admin"},
            {"_id": 0}
        )
    else:
        # Buscar por email normal
        user_doc = await db.users.find_one(
            {"email": credentials.email},
            {"_id": 0}
        )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password_hash'})
    token = create_token(user.id, user.email)
    
    return TokenResponse(token=token, user=user)

@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Obtener usuario actual"""
    return current_user

@router.put("/update-profile")
async def update_profile(
    name: str = None,
    current_password: str = None,
    new_password: str = None,
    current_user: User = Depends(get_current_user)
):
    """Actualizar perfil de usuario (nombre y/o contraseña)"""
    update_data = {}
    
    # Update name if provided
    if name:
        update_data['name'] = name
    
    # Update password if provided
    if new_password:
        if not current_password:
            raise HTTPException(status_code=400, detail="Se requiere contraseña actual")
        
        # Verify current password
        user_doc = await db.users.find_one({'id': current_user.id}, {'_id': 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        if not bcrypt.checkpw(current_password.encode('utf-8'), user_doc['password_hash'].encode('utf-8')):
            raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
        
        # Hash new password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        update_data['password_hash'] = hashed_password.decode('utf-8')
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay cambios para actualizar")
    
    # Update user
    await db.users.update_one(
        {'id': current_user.id},
        {'$set': update_data}
    )
    
    return {"message": "Perfil actualizado exitosamente"}

@router.get("/account/info")
async def get_account_info(current_user: User = Depends(get_current_user)):
    """Obtener información de la cuenta del usuario actual"""
    if not current_user.account_id:
        raise HTTPException(status_code=404, detail="Usuario no tiene cuenta asignada")
    
    account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
    
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    return {
        "id": account.get("id"),
        "business_name": account.get("business_name"),
        "plan": account.get("plan"),
        "max_stores": account.get("max_stores"),
        "max_employees": account.get("max_employees"),
        "stores": account.get("stores", []),
        "enabled_modules": account.get("enabled_modules", [])
    }

@router.put("/account/stores")
async def update_account_stores(
    stores_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Actualizar nombres de tiendas de la cuenta (solo account_admin y supervisor)"""
    # Verificar que el usuario tenga permisos
    if current_user.role not in ["account_admin", "supervisor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar tiendas"
        )
    
    if not current_user.account_id:
        raise HTTPException(status_code=404, detail="Usuario no tiene cuenta asignada")
    
    try:
        # Obtener cuenta actual
        account = await db.accounts.find_one({"id": current_user.account_id}, {"_id": 0})
        
        if not account:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
        # Actualizar nombres de tiendas manteniendo otros campos
        updated_stores = []
        for new_store in stores_data.get("stores", []):
            # Buscar la tienda existente
            existing_store = next(
                (s for s in account.get("stores", []) if s.get("id") == new_store.get("id")),
                None
            )
            
            if existing_store:
                # Mantener todos los campos y actualizar el nombre y código
                updated_store = existing_store.copy()
                updated_store["name"] = new_store.get("name", existing_store.get("name"))
                updated_store["code"] = new_store.get("code", existing_store.get("code"))
                updated_stores.append(updated_store)
        
        # Actualizar en la base de datos
        await db.accounts.update_one(
            {"id": current_user.account_id},
            {
                "$set": {
                    "stores": updated_stores,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Nombres de tiendas actualizados exitosamente",
            "stores": updated_stores
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar tiendas: {str(e)}"
        )
