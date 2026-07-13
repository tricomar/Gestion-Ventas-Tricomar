"""
Router para gestión de notas y calendario diario
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from models.notes import Note, NoteCreate, NoteUpdate, NoteRead
from models.users import User
from utils import db, get_current_user

router = APIRouter(prefix="/notes", tags=["notes"])

@router.post("", response_model=Note)
async def create_note(
    note_input: NoteCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new note"""
    note = Note(
        **note_input.model_dump(),
        author_id=current_user.id,
        author_name=current_user.name
    )
    
    doc = note.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.notes.insert_one(doc)
    return note

@router.get("")
async def get_notes(
    date: Optional[str] = None,
    note_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get notes with optional filters"""
    query = {}
    
    if date:
        query['date'] = date
    if note_status:
        query['status'] = note_status
    
    notes = await db.notes.find(query, {'_id': 0}).to_list(1000)
    
    # Convert ISO strings to datetime objects for Pydantic
    for note in notes:
        if isinstance(note.get('created_at'), str):
            note['created_at'] = datetime.fromisoformat(note['created_at'])
        if isinstance(note.get('updated_at'), str):
            note['updated_at'] = datetime.fromisoformat(note['updated_at'])
    
    # Get read status for current user
    result = []
    for note in notes:
        note_read = await db.note_reads.find_one({
            'note_id': note['id'],
            'user_id': current_user.id
        }, {'_id': 0})
        
        note['read_by_current_user'] = note_read is not None
        result.append(note)
    
    return result

@router.get("/{note_id}")
async def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific note"""
    note = await db.notes.find_one({'id': note_id}, {'_id': 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if isinstance(note.get('created_at'), str):
        note['created_at'] = datetime.fromisoformat(note['created_at'])
    if isinstance(note.get('updated_at'), str):
        note['updated_at'] = datetime.fromisoformat(note['updated_at'])
    
    return note

@router.put("/{note_id}", response_model=Note)
async def update_note(
    note_id: str,
    note_update: NoteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a note"""
    note = await db.notes.find_one({'id': note_id}, {'_id': 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only author or admin can update
    if note['author_id'] != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta nota")
    
    update_data = {k: v for k, v in note_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.notes.update_one(
        {'id': note_id},
        {'$set': update_data}
    )
    
    # Fetch updated note
    updated_note = await db.notes.find_one({'id': note_id}, {'_id': 0})
    if isinstance(updated_note.get('created_at'), str):
        updated_note['created_at'] = datetime.fromisoformat(updated_note['created_at'])
    if isinstance(updated_note.get('updated_at'), str):
        updated_note['updated_at'] = datetime.fromisoformat(updated_note['updated_at'])
    
    return Note(**updated_note)

@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a note"""
    note = await db.notes.find_one({'id': note_id}, {'_id': 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only author or admin can delete
    if note['author_id'] != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta nota")
    
    await db.notes.delete_one({'id': note_id})
    await db.note_reads.delete_many({'note_id': note_id})
    
    return {"message": "Note deleted successfully"}

@router.post("/{note_id}/read")
async def mark_note_as_read(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a note as read by current user"""
    note = await db.notes.find_one({'id': note_id}, {'_id': 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Check if already read
    existing = await db.note_reads.find_one({
        'note_id': note_id,
        'user_id': current_user.id
    }, {'_id': 0})
    
    if not existing:
        note_read = NoteRead(
            note_id=note_id,
            user_id=current_user.id,
            user_name=current_user.name
        )
        doc = note_read.model_dump()
        doc['read_at'] = doc['read_at'].isoformat()
        await db.note_reads.insert_one(doc)
    
    return {"message": "Note marked as read"}

@router.get("/calendar/days")
async def get_calendar_days(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user)
):
    """Get days with notes for calendar visualization"""
    from calendar import monthrange
    
    # Get all notes for the month
    days_in_month = monthrange(year, month)[1]
    result = {}
    
    for day in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        notes = await db.notes.find({'date': date_str}, {'_id': 0}).to_list(100)
        
        if notes:
            # Count notes by status
            status_counts = {
                'unread': 0,
                'read': 0,
                'pending': 0,
                'completed': 0
            }
            
            for note in notes:
                status = note.get('status', 'unread')
                status_counts[status] += 1
            
            result[day] = {
                'total': len(notes),
                'statuses': status_counts
            }
    
    return result
