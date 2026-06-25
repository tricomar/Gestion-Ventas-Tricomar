import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ExpenseForm = ({ onSuccess }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('otros');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/expenses`, {
        description,
        amount: parseFloat(amount),
        category
      });

      toast.success('Egreso registrado exitosamente');
      
      setDescription('');
      setAmount('');
      setCategory('otros');
      
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Error al registrar egreso');
      console.error('Error creating expense:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8"
      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      data-testid="expense-form"
    >
      <h2 
        className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-6"
        style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
      >
        Registrar Egreso
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
            placeholder="Ej: Compra de materiales, Pago de servicios..."
            className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
            required
            data-testid="expense-description-input"
          />
        </div>

        <div>
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
            Categoría *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 cursor-pointer focus:ring-0 focus:outline-none focus:border-indigo-500"
            data-testid="expense-category-select"
          >
            <option value="compra_inventario">Compra de Inventario</option>
            <option value="retiros">Retiros</option>
            <option value="compras_informales">Compras Informales</option>
            <option value="otros">Otros</option>
          </select>
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
            data-testid="expense-amount-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
          style={{
            backgroundColor: '#FFA8A8',
            boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
          }}
          onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          data-testid="expense-submit-btn"
        >
          {loading ? 'Guardando...' : 'Registrar Egreso'}
        </button>
      </form>
    </div>
  );
};

export default ExpenseForm;
