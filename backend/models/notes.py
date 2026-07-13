from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import List, Optional
import uuid

class NoteBase(BaseModel):
    date: str  # Format: YYYY-MM-DD
    subject: str
    message: str
    mentions: List[str] = []  # List of user IDs mentioned with @
    status: str = "unread"  # unread, read, pending, completed

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    subject: Optional[str] = None
    message: Optional[str] = None
    mentions: Optional[List[str]] = None
    status: Optional[str] = None

class Note(NoteBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author_id: str
    author_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NoteRead(BaseModel):
    """Track which users have read a note"""
    note_id: str
    user_id: str
    user_name: str
    read_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
