import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { StickyNote, Plus, Edit2, Trash2, Check, X, Users } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_COLORS = {
  unread: '#FFE5B4',
  read: '#E0E7FF',
  pending: '#FADBB0',
  completed: '#D1FAE5'
};

const STATUS_LABELS = {
  unread: 'Sin leer',
  read: 'Leída',
  pending: 'Pendiente',
  completed: 'Completada'
};

const DailyNotes = ({ selectedDate, onNoteChange }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    status: 'unread'
  });

  useEffect(() => {
    if (selectedDate) {
      fetchNotes();
    }
  }, [selectedDate]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/notes?date=${selectedDate}`);
      setNotes(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Error al cargar notas');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingNote) {
        // Update existing note
        await axios.put(`${API}/notes/${editingNote.id}`, formData);
        toast.success('Nota actualizada');
      } else {
        // Create new note
        await axios.post(`${API}/notes`, {
          ...formData,
          date: selectedDate
        });
        toast.success('Nota creada');
      }
      
      setFormData({ subject: '', message: '', status: 'unread' });
      setShowForm(false);
      setEditingNote(null);
      fetchNotes();
      if (onNoteChange) onNoteChange();
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Error al guardar nota');
    }
  };

  const handleEdit = (note) => {
    setEditingNote(note);
    setFormData({
      subject: note.subject,
      message: note.message,
      status: note.status
    });
    setShowForm(true);
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta nota?')) return;
    
    try {
      await axios.delete(`${API}/notes/${noteId}`);
      toast.success('Nota eliminada');
      fetchNotes();
      if (onNoteChange) onNoteChange();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error al eliminar nota');
    }
  };

  const handleStatusChange = async (noteId, newStatus) => {
    try {
      await axios.put(`${API}/notes/${noteId}`, { status: newStatus });
      toast.success('Estado actualizado');
      fetchNotes();
      if (onNoteChange) onNoteChange();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setFormData({ subject: '', message: '', status: 'unread' });
  };

  return (
    <div className="border-2 border-slate-900 rounded-xl bg-white p-4" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <StickyNote className="w-5 h-5" />
          Notas del Día
        </h3>
        {selectedDate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-bold border-2 border-slate-900 rounded-lg bg-lime-200 hover:bg-lime-300"
            style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
          >
            <Plus className="w-4 h-4" />
            Nueva Nota
          </button>
        )}
      </div>

      {!selectedDate ? (
        <div className="text-center py-8 text-slate-500">
          <StickyNote className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecciona una fecha en el calendario</p>
        </div>
      ) : (
        <>
          {/* Note Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-4 p-4 border-2 border-slate-900 rounded-lg bg-slate-50">
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">ASUNTO *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Ej: Pedido urgente, Reunión equipo..."
                  required
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">MENSAJE *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                  rows="3"
                  placeholder="Escribe los detalles de la nota..."
                  required
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">ESTADO</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800"
                  style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                >
                  {editingNote ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 border-2 border-slate-900 font-bold rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Notes List */}
          {loading ? (
            <div className="text-center py-4 text-slate-500">Cargando notas...</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No hay notas para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 border-2 border-slate-900 rounded-lg"
                  style={{ backgroundColor: STATUS_COLORS[note.status] }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-slate-900">{note.subject}</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(note)}
                        className="p-1 hover:bg-white/50 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1 hover:bg-white/50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 mb-2 whitespace-pre-wrap">{note.message}</p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      <span className="font-medium">{note.author_name}</span>
                    </div>

                    <select
                      value={note.status}
                      onChange={(e) => handleStatusChange(note.id, e.target.value)}
                      className="px-2 py-1 border-2 border-slate-900 rounded text-xs font-bold bg-white"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyNotes;
