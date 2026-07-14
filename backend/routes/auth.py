"""
Router de autenticación
Maneja registro, login y actualización de perfil
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import bcrypt

from models.users import User, UserCreate, UserLogin, TokenResponse
from utils import db, hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(user_input: UserCreate):
    """Registrar un nuevo usuario"""
    # Check if user exists
    existing = await db.users.find_one({'email': user_input.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_input.model_dump(exclude={'password'})
    user = User(**user_dict)
    
    # Hash password and store
    doc = user.model_dump()
    doc['password_hash'] = hash_password(user_input.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Generate token
    token = create_token(user.id, user.email)
    
    return TokenResponse(token=token, user=user)

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Iniciar sesión
    - Si el usuario es exactamente "admin" (sin @ventas.com), busca admin@ventas.com
    - Para el resto de usuarios, requiere email completo
    """
    # Permitir login con "admin" (sin @ventas.com) solo para el super administrador
    search_email = credentials.email
    if credentials.email == "admin":
        search_email = "admin@ventas.com"
    
    user_doc = await db.users.find_one({'email': search_email}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
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
