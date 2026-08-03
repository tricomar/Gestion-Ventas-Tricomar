import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Store, Save } from 'lucide-react';
import { useStores } from '../../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StoresTab = () => {
  const { stores } = useStores();
  const [storeNames, setStoreNames] = useState({});
  const [storeCodes, setStoreCodes] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (stores && stores.length > 0) {
      const names = {};
      const codes = {};
      stores.forEach(store => {
        names[store.id] = store.name;
        codes[store.id] = store.code || '';
      });
      setStoreNames(names);
      setStoreCodes(codes);
    }
  }, [stores]);

  const handleSaveStoreNames = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.put(`${API}/auth/account/stores`, {
        stores: stores.map(store => ({
          id: store.id,
          name: storeNames[store.id] || store.name,
          code: storeCodes[store.id] || store.code
        }))
      });

      toast.success('Tiendas/Cajas actualizadas correctamente');
      window.location.reload();
    } catch (error) {
      toast.error('Error al guardar cambios');
      console.error('Error saving store names:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-8"
      style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <Store className="w-6 h-6" />
        <h2 className="text-2xl font-bold text-slate-900">Configuración de Tiendas/Cajas</h2>
      </div>
      
      <p className="text-sm text-slate-600 mb-6">
        Personaliza los nombres de tus tiendas. Para agregar nuevas tiendas, contacta al super-administrador.
      </p>
      
      {stores && stores.length > 0 ? (
        <form onSubmit={handleSaveStoreNames} className="space-y-6">
          {stores.map((store, index) => (
            <div key={store.id} className="border-2 border-slate-900 rounded-xl p-4 bg-slate-50">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                {index === 0 ? 'Tienda/Caja Principal' : `Tienda/Caja ${index + 1}`}
                {index === 0 && <span className="ml-2 text-xs text-blue-600">(Por defecto)</span>}
              </label>
              
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre de la Tienda/Caja
                </label>
                <input
                  type="text"
                  value={storeNames[store.id] || store.name}
                  onChange={(e) => setStoreNames({...storeNames, [store.id]: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                  maxLength={50}
                  placeholder={store.name}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Código de la Tienda/Caja
                </label>
                <input
                  type="text"
                  value={storeCodes[store.id] || store.code}
                  onChange={(e) => setStoreCodes({...storeCodes, [store.id]: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                  maxLength={3}
                  placeholder={store.code}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Máximo 3 caracteres. Se usará en registros y reportes.
                </p>
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl font-bold hover:bg-[#c5e196] disabled:opacity-50 transition-all"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      ) : (
        <div className="text-center py-8 text-slate-600">
          <Store className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p>No hay tiendas configuradas para tu cuenta.</p>
          <p className="text-sm mt-2">Contacta al super-administrador.</p>
        </div>
      )}
    </div>
  );
};

export default StoresTab;
