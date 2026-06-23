import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Home, Settings as SettingsIcon, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SettingsPage = () => {
  const navigate = useNavigate();
  const { refreshSettings } = useSettings();
  const [storeAName, setStoreAName] = useState('Tienda A');
  const [storeBName, setStoreBName] = useState('Tienda B');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setStoreAName(response.data.store_a_name);
      setStoreBName(response.data.store_b_name);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.put(`${API}/settings`, {
        store_a_name: storeAName,
        store_b_name: storeBName
      });

      toast.success('Configuración guardada exitosamente');
      refreshSettings(); // Refresh settings in context
    } catch (error) {
      toast.error('Error al guardar configuración');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: '#F4F4F0', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="back-to-dashboard-btn"
          >
            <Home className="w-5 h-5" />
          </button>
          <div>
            <h1 
              className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
            >
              Configuración
            </h1>
            <p className="text-base font-medium text-slate-600">Personaliza tu sistema</p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      {loading ? (
        <p className="text-center text-slate-600 font-medium">Cargando configuración...</p>
      ) : (
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8 max-w-2xl"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="w-8 h-8" />
            <h2 className="text-2xl font-bold text-slate-900">Nombres de Tiendas</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Store A Name */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Nombre Tienda A
              </label>
              <input
                type="text"
                value={storeAName}
                onChange={(e) => setStoreAName(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Ej: Sucursal Centro, Tienda Principal..."
                required
                data-testid="store-a-name-input"
              />
              <p className="text-xs text-slate-500 mt-2">
                Este nombre aparecerá en todo el sistema para identificar la Tienda A
              </p>
            </div>

            {/* Store B Name */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Nombre Tienda B
              </label>
              <input
                type="text"
                value={storeBName}
                onChange={(e) => setStoreBName(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Ej: Sucursal Norte, Tienda Secundaria..."
                required
                data-testid="store-b-name-input"
              />
              <p className="text-xs text-slate-500 mt-2">
                Este nombre aparecerá en todo el sistema para identificar la Tienda B
              </p>
            </div>

            {/* Preview */}
            <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-4">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-3">Vista Previa</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <span 
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-slate-900"
                    style={{ backgroundColor: '#D4F0A5' }}
                  >
                    {storeAName || 'Tienda A'}
                  </span>
                </div>
                <div className="flex-1">
                  <span 
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-slate-900"
                    style={{ backgroundColor: '#FADBB0' }}
                  >
                    {storeBName || 'Tienda B'}
                  </span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
              style={{
                backgroundColor: '#D4F0A5',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
              onMouseEnter={(e) => !saving && (e.target.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              data-testid="save-settings-btn"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
