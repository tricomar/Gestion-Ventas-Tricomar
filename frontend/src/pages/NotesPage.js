import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { StickyNote, Plus, Calendar, Edit2, Trash2, Save, X, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotesCalendar from '../components/NotesCalendar';
import DailyNotes from '../components/DailyNotes';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotesPage = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [selectedDate]);

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API}/notes?date=${selectedDate}`);
      setNotes(response.data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.title.trim() || !newNote.content.trim()) {
      toast.error('Completa todos los campos');
      return;
    }

    try {
      await axios.post(`${API}/notes`, {
        ...newNote,
        date: selectedDate,
        created_at: new Date().toISOString()
      });

      toast.success('Nota creada exitosamente', {
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });

      setNewNote({ title: '', content: '' });
      setShowAddModal(false);
      fetchNotes();
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Error al crear la nota');
    }
  };

  const handleUpdateNote = async (noteId, updates) => {
    try {
      await axios.patch(`${API}/notes/${noteId}`, updates);
      toast.success('Nota actualizada');
      fetchNotes();
      setEditingNote(null);
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Error al actualizar la nota');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;

    try {
      await axios.delete(`${API}/notes/${noteId}`);
      toast.success('Nota eliminada');
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error al eliminar la nota');
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando notas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-5xl font-black text-slate-900 mb-2"
          style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
        >
          📝 Notas
        </h1>
        <p className="text-lg text-slate-600 font-medium">
          Gestiona tus notas y recordatorios diarios
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 border-2 border-slate-900 rounded-xl font-bold transition-all ${
              viewMode === 'calendar'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-900 hover:bg-slate-50'
            }`}
            style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
          >
            <Calendar className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 border-2 border-slate-900 rounded-xl font-bold transition-all ${
              viewMode === 'list'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-900 hover:bg-slate-50'
            }`}
            style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
          >
            <StickyNote className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full pl-12 pr-4 py-3 border-2 border-slate-900 rounded-xl font-medium"
          />
        </div>

        {/* Add Note Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center gap-2"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <Plus className="w-5 h-5" />
          Nueva Nota
        </button>
      </div>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-1">
            <NotesCalendar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              notesData={notes}
            />
          </div>

          {/* Notes for Selected Date */}
          <div className="lg:col-span-2">
            <DailyNotes
              date={selectedDate}
              notes={filteredNotes}
              onEdit={handleUpdateNote}
              onDelete={handleDeleteNote}
              onRefresh={fetchNotes}
            />
          </div>
        </div>
      ) : (
        /* List View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-slate-900 rounded-xl p-6"
              style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            >
              {editingNote === note.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    defaultValue={note.title}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg font-bold"
                    onBlur={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                  />
                  <textarea
                    defaultValue={note.content}
                    rows={4}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg resize-none"
                    onBlur={(e) => handleUpdateNote(note.id, { content: e.target.value })}
                  />
                  <button
                    onClick={() => setEditingNote(null)}
                    className="px-3 py-1 bg-green-500 text-white rounded font-bold"
                  >
                    Listo
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-black text-slate-900">{note.title}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingNote(note.id)}
                        className="p-1 hover:bg-blue-100 rounded"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">{note.content}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(note.date).toLocaleDateString('es-CL')}
                  </p>
                </>
              )}
            </div>
          ))}

          {filteredNotes.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No hay notas para esta búsqueda
            </div>
          )}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="bg-white border-4 border-slate-900 rounded-xl p-8 max-w-md w-full"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900">Nueva Nota</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewNote({ title: '', content: '' });
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Título</label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Ej: Recordatorio importante"
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Contenido</label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Escribe tu nota aquí..."
                  rows={5}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium resize-none"
                />
              </div>

              <button
                onClick={handleAddNote}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <Save className="w-5 h-5 inline mr-2" />
                Guardar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesPage;
