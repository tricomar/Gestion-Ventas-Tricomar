import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CustomerForm = ({ customer, initialName, storeAName, storeBName, onClose, onSuccess }) => {
  const { settings } = useSettings();
  
  // Use props as fallback if settings context isn't available
  const finalStoreAName = storeAName || settings.store_a_name || 'Tienda A';
  const finalStoreBName = storeBName || settings.store_b_name || 'Tienda B';
  
  const [formData, setFormData] = useState({
    name: customer?.name || initialName || '',
    address: customer?.address || '',
    phone: customer?.phone || '',
    store: customer?.store || 'A'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (customer) {
        // Update existing customer
        const response = await axios.put(`${API}/customers/${customer.id}`, formData);
        toast.success('Cliente actualizado exitosamente');
        onSuccess(response.data);
      } else {
        // Create new customer
        const response = await axios.post(`${API}/customers`, formData);
        toast.success('Cliente creado exitosamente');
        onSuccess(response.data);
      }
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Error al guardar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border-2 border-slate-900 p-6 w-full max-w-md" style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">NOMBRE *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">DIRECCIÓN / SECTOR</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Ej: Sector Centro, Calle..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">TELÉFONO</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Ej: +56912345678"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2">TIENDA</label>
            <select
              value={formData.store}
              onChange={(e) => setFormData({ ...formData, store: e.target.value })}
              className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="A">{finalStoreAName}</option>
              <option value="B">{finalStoreBName}</option>
              <option value="Ambas">Ambas</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50"
              style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            >
              {loading ? 'Guardando...' : customer ? 'Actualizar Cliente' : 'Crear Cliente'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-slate-900 font-bold rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerForm;
