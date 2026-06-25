import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OtherIncomeForm = ({ onSuccess }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/other-income`, {
        description,
        amount: parseFloat(amount)
      });

      toast.success('Ingreso registrado exitosamente');
      
      setDescription('');
      setAmount('');
      
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Error al registrar ingreso');
      console.error('Error creating income:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8"
      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      data-testid="other-income-form"
    >
      <h2 
        className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-6"
        style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
      >
        Registrar Otro Ingreso
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
            Descripción *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Propinas, Reembolso, Comisión..."
            className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
            required
            data-testid="income-description-input"
          />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
            Monto *
          </label>
          <input
            type="number"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
            required
            data-testid="income-amount-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
          style={{
            backgroundColor: '#FADBB0',
            boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
          }}
          onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          data-testid="income-submit-btn"
        >
          {loading ? 'Guardando...' : 'Registrar Ingreso'}
        </button>
      </form>
    </div>
  );
};

export default OtherIncomeForm;
