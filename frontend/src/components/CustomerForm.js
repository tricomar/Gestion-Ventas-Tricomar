import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useStores } from '../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Validación de RUT chileno
const validateRUT = (rut) => {
  if (!rut) return true;
  
  const rutClean = rut.replace(/\./g, '').replace('-', '').toUpperCase();
  if (rutClean.length < 2) return false;
  
  const rutNum = rutClean.slice(0, -1);
  const rutDv = rutClean.slice(-1);
  
  if (!/^\d+$/.test(rutNum)) return false;
  
  let suma = 0;
  let multiplo = 2;
  
  for (let i = rutNum.length - 1; i >= 0; i--) {
    suma += parseInt(rutNum[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  
  const dvCalculado = 11 - (suma % 11);
  let dvEsperado;
  
  if (dvCalculado === 11) dvEsperado = '0';
  else if (dvCalculado === 10) dvEsperado = 'K';
  else dvEsperado = String(dvCalculado);
  
  return rutDv === dvEsperado;
};

// Formatear RUT: 12345678-5 → 12.345.678-5
const formatRUT = (rut) => {
  const rutClean = rut.replace(/[^0-9kK]/g, '');
  if (rutClean.length <= 1) return rutClean;
  
  const dv = rutClean.slice(-1);
  const number = rutClean.slice(0, -1);
  
  const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
};

const CustomerForm = ({ customer, initialName, onClose, onSuccess }) => {
  const { settings, loading: settingsLoading } = useSettings();
  const { stores, loading: storesLoading } = useStores();
  
  const [formData, setFormData] = useState({
    name: customer?.name || initialName || '',
    customer_type: customer?.customer_type || 'Persona',
    rut: customer?.rut || '',
    sin_rut: customer?.sin_rut || false,
    nombre_fantasia: customer?.nombre_fantasia || '',
    giro: customer?.giro || '',
    direccion: customer?.direccion || '',
    ciudad: customer?.ciudad || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    store: customer?.store || (stores && stores.length > 0 ? stores[0].id : '')
  });
  const [loading, setLoading] = useState(false);
  const [rutError, setRutError] = useState('');
  
  // Wait for settings and stores to load before rendering form
  if (settingsLoading || storesLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl border-2 border-slate-900 p-6 w-full max-w-md" style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-sm text-slate-600">Cargando configuración...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Validar RUT al cambiar
  const handleRutChange = (value) => {
    setFormData({ ...formData, rut: value });
    
    if (value && !formData.sin_rut) {
      if (validateRUT(value)) {
        setRutError('');
      } else {
        setRutError('RUT inválido');
      }
    } else {
      setRutError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar RUT antes de enviar
    if (formData.rut && !formData.sin_rut && !validateRUT(formData.rut)) {
      toast.error('RUT inválido');
      return;
    }
    
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
      const errorMsg = error.response?.data?.detail || 'Error al guardar cliente';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border-2 border-slate-900 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tipo de Cliente */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-2">TIPO DE CLIENTE *</label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              >
                <option value="Persona">Persona</option>
                <option value="Empresa">Empresa</option>
              </select>
            </div>

            {/* Nombre/Razón Social */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-2">NOMBRE/RAZÓN SOCIAL *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Ej: Juan Pérez o Empresa SpA"
                required
              />
            </div>

            {/* RUT */}
            <div>
              <label className="block text-sm font-bold mb-2">
                RUT {formData.customer_type === 'Empresa' && '*'}
              </label>
              <input
                type="text"
                value={formData.rut}
                onChange={(e) => handleRutChange(e.target.value)}
                disabled={formData.sin_rut}
                className={`w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                  formData.sin_rut ? 'bg-slate-100 text-slate-400' : ''
                } ${rutError ? 'border-red-500' : ''}`}
                placeholder="12.345.678-5"
                required={formData.customer_type === 'Empresa' && !formData.sin_rut}
              />
              {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
            </div>

            {/* Checkbox Sin RUT */}
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.sin_rut}
                  onChange={(e) => {
                    setFormData({ ...formData, sin_rut: e.target.checked, rut: e.target.checked ? '' : formData.rut });
                    setRutError('');
                  }}
                  className="w-4 h-4 border-2 border-slate-900 rounded"
                />
                <span className="text-sm font-bold">Sin RUT</span>
              </label>
            </div>

            {/* Nombre de Fantasía (solo Empresa) */}
            {formData.customer_type === 'Empresa' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2">NOMBRE DE FANTASÍA</label>
                <input
                  type="text"
                  value={formData.nombre_fantasia}
                  onChange={(e) => setFormData({ ...formData, nombre_fantasia: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Ej: Mi Empresa"
                />
              </div>
            )}

            {/* Giro (solo Empresa) */}
            {formData.customer_type === 'Empresa' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2">GIRO</label>
                <input
                  type="text"
                  value={formData.giro}
                  onChange={(e) => setFormData({ ...formData, giro: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Ej: Comercio al por menor"
                />
              </div>
            )}

            {/* Dirección */}
            <div>
              <label className="block text-sm font-bold mb-2">DIRECCIÓN</label>
              <input
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Ej: Av. Principal 123"
              />
            </div>

            {/* Ciudad */}
            <div>
              <label className="block text-sm font-bold mb-2">CIUDAD</label>
              <input
                type="text"
                value={formData.ciudad}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Ej: Santiago"
              />
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block text-sm font-bold mb-2">CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="correo@ejemplo.cl"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-bold mb-2">TELÉFONO</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="+56912345678"
              />
            </div>

            {/* Tienda/Caja */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-2">TIENDA/CAJA *</label>
              <select
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              >
                <option value="">Selecciona una tienda/caja</option>
                {stores && stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              disabled={loading || (formData.rut && !formData.sin_rut && rutError)}
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
