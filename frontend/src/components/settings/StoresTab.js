import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Store, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useAccount } from '../../context/AccountContext';
import { useAuth } from '../../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StoresTab = () => {
  const { user } = useAuth();
  const { account, refreshAccount } = useAccount();
  const stores = account?.stores || [];
  const [storeNames, setStoreNames] = useState({});
  const [storeCodes, setStoreCodes] = useState({});
  const [saving, setSaving] = useState(false);
  const maxStores = account?.max_stores || 1;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');

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
      refreshAccount();
    } catch (error) {
      toast.error('Error al guardar cambios');
      console.error('Error saving store names:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddStore = async (e) => {
    e.preventDefault();
    
    if (!newStoreName.trim()) {
      toast.error('El nombre de la tienda es requerido');
      return;
    }

    if (!newStoreCode.trim() || newStoreCode.trim().length > 3) {
      toast.error('El código debe tener máximo 3 caracteres');
      return;
    }

    if (stores.length >= maxStores) {
      toast.error(`Has alcanzado el límite de ${maxStores} tienda(s) para tu plan`);
      return;
    }

    setSaving(true);

    try {
      const newStore = {
        id: `store_${Date.now()}`,
        name: newStoreName.trim(),
        code: newStoreCode.trim().toUpperCase()
      };

      const updatedStores = [...stores, newStore];

      await axios.put(`${API}/auth/account/stores`, {
        stores: updatedStores.map(store => ({
          id: store.id,
          name: store.name,
          code: store.code
        }))
      });

      toast.success('Tienda agregada exitosamente');
      setNewStoreName('');
      setNewStoreCode('');
      setShowAddForm(false);
      refreshAccount();
    } catch (error) {
      toast.error('Error al agregar tienda');
      console.error('Error adding store:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (stores.length <= 1) {
      toast.error('No puedes eliminar la última tienda');
      return;
    }

    const storeToDelete = stores.find(s => s.id === storeId);
    if (!storeToDelete) return;

    const confirmed = window.confirm(
      `¿Estás seguro de eliminar "${storeToDelete.name}"?\n\n⚠️ Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const updatedStores = stores.filter(s => s.id !== storeId);

      await axios.put(`${API}/auth/account/stores`, {
        stores: updatedStores.map(store => ({
          id: store.id,
          name: store.name,
          code: store.code
        }))
      });

      toast.success('Tienda eliminada exitosamente');
      refreshAccount();
    } catch (error) {
      toast.error('Error al eliminar tienda');
      console.error('Error deleting store:', error);
    } finally {
      setSaving(false);
    }
  };

  const canAddStore = stores.length < maxStores;

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-8"
      style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6" />
          <h2 className="text-2xl font-bold text-slate-900">Configuración de Tiendas/Cajas</h2>
        </div>
        <div className="text-sm font-bold text-slate-600">
          {stores.length} / {maxStores} tiendas
        </div>
      </div>
      
      {/* Info Alert */}
      <div className="bg-blue-50 border-2 border-blue-900 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-900 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p><strong>Gestiona tus tiendas/cajas:</strong></p>
            <ul className="list-disc ml-4 mt-1">
              <li>Puedes tener hasta <strong>{maxStores}</strong> tienda(s) según tu plan</li>
              <li>Edita nombres y códigos de tiendas existentes</li>
              <li>Agrega nuevas tiendas si no has alcanzado el límite</li>
              <li>Elimina tiendas que ya no necesites (mínimo 1)</li>
            </ul>
          </div>
        </div>
      </div>
      
      {stores && stores.length > 0 ? (
        <form onSubmit={handleSaveStoreNames} className="space-y-6">
          {stores.map((store, index) => (
            <div key={store.id} className="border-2 border-slate-900 rounded-xl p-4 bg-slate-50 relative">
              <div className="flex items-start justify-between mb-3">
                <label className="block text-sm font-bold text-slate-700">
                  {index === 0 ? 'Tienda/Caja Principal' : `Tienda/Caja ${index + 1}`}
                  {index === 0 && <span className="ml-2 text-xs text-blue-600">(Por defecto)</span>}
                </label>
                
                {stores.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStore(store.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    title="Eliminar tienda"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
              
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
                  required
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
        </div>
      )}

      {/* Add Store Button/Form */}
      {canAddStore && (
        <div className="mt-6 pt-6 border-t-2 border-slate-200">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-2"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <Plus className="w-5 h-5" />
              Agregar Nueva Tienda/Caja
            </button>
          ) : (
            <div className="border-2 border-purple-500 rounded-xl p-4 bg-purple-50">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Nueva Tienda/Caja</h3>
              <form onSubmit={handleAddStore} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nombre de la Tienda/Caja
                  </label>
                  <input
                    type="text"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ej: Sucursal Centro, Caja 2"
                    maxLength={50}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Código de la Tienda/Caja
                  </label>
                  <input
                    type="text"
                    value={newStoreCode}
                    onChange={(e) => setNewStoreCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ej: B, C2"
                    maxLength={3}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Máximo 3 caracteres únicos
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-purple-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:bg-purple-600 disabled:opacity-50 transition-all"
                    style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
                  >
                    {saving ? 'Agregando...' : 'Agregar Tienda'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewStoreName('');
                      setNewStoreCode('');
                    }}
                    className="px-4 py-3 bg-slate-200 border-2 border-slate-900 rounded-xl font-bold text-slate-900 hover:bg-slate-300 transition-all"
                    style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {!canAddStore && stores.length >= maxStores && (
        <div className="mt-6 pt-6 border-t-2 border-slate-200">
          <div className="bg-orange-50 border-2 border-orange-900 rounded-lg p-4 text-center">
            <p className="text-sm text-orange-900">
              <strong>Has alcanzado el límite de {maxStores} tienda(s)</strong><br/>
              Para agregar más tiendas, contacta al super-administrador para mejorar tu plan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoresTab;
