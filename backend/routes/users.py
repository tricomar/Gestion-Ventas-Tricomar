"""
Router para gestión de usuarios (admin only)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import bcrypt

from models.users import User, UserCreate, UserUpdate
from utils import db, get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/users", response_model=List[User])
async def get_all_users(admin: User = Depends(require_admin)):
    """Get all users (admin only)"""
    users = await db.users.find({}, {'_id': 0, 'password_hash': 0}).sort('created_at', -1).to_list(1000)
    
    result = []
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        result.append(User(**user))
    
    return result

@router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, admin: User = Depends(require_admin)):
    """Create a new user (admin only)"""
    # Check if email already exists
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya está registrado")
    
    # Create user
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    
    new_user = {
        'id': str(uuid.uuid4()),
        'email': user_data.email,
        'name': user_data.name,
        'role': user_data.role,
        'password_hash': hashed_password.decode('utf-8'),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    # Return user without password_hash
    return User(
        id=new_user['id'],
        email=new_user['email'],
        name=new_user['name'],
        role=new_user['role'],
        created_at=datetime.fromisoformat(new_user['created_at'])
    )

@router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    admin: User = Depends(require_admin)
):
    """Update any user (admin only)"""
    # Find user
    user = await db.users.find_one({'id': user_id}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Prevent admin from demoting themselves
    if user_id == admin.id and user_data.role and user_data.role != "admin":
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol de administrador")
    
    update_data = {}
    
    # Update email if provided and changed
    if user_data.email and user_data.email != user['email']:
        # Check if new email is already taken
        existing = await db.users.find_one({'email': user_data.email, 'id': {'$ne': user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email ya está en uso")
        update_data['email'] = user_data.email
    
    # Update name if provided
    if user_data.name:
        update_data['name'] = user_data.name
    
    # Update role if provided
    if user_data.role:
        update_data['role'] = user_data.role
    
    # Update password if provided
    if user_data.password:
        hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
        update_data['password_hash'] = hashed_password.decode('utf-8')
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay cambios para actualizar")
    
    # Update user
    await db.users.update_one({'id': user_id}, {'$set': update_data})
    
    # Get updated user
    updated_user = await db.users.find_one({'id': user_id}, {'_id': 0})
    if isinstance(updated_user.get('created_at'), str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    
    return User(**updated_user)

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: User = Depends(require_admin)):
    """Delete a user (admin only)"""
    # Prevent admin from deleting themselves
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    
    result = await db.users.delete_one({'id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario eliminado exitosamente"}
