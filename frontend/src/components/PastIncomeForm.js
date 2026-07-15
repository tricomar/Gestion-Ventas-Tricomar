import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PastIncomeForm = ({ onClose, onSuccess, initialDate }) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [customDate, setCustomDate] = useState(initialDate || '');
  const [customTime, setCustomTime] = useState('12:00');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!customDate) {
      toast.error('Debes seleccionar una fecha');
      return;
    }
    
    const dateTime = `${customDate}T${customTime}:00`;
    
    setLoading(true);
    try {
      await axios.post(`${API}/other-income/past`, {
        description,
        amount: parseFloat(amount),
        custom_date: dateTime
      });
      
      toast.success('Ingreso registrado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al registrar ingreso:', error);
      toast.error(error.response?.data?.detail || 'Error al registrar ingreso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-900">Registrar Ingreso Pasado</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descripción */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Descripción *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Ingreso por servicios"
              required
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Monto *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Fecha *
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Hora */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Hora *
            </label>
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg font-bold hover:bg-[#c5e196] transition-all disabled:opacity-50"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              {loading ? 'Registrando...' : 'Registrar Ingreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PastIncomeForm;
