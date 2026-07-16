import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Store, Edit2, Trash2, Plus, Building2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TiendasGlobalesPage = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', code: '' });

  useEffect(() => {
    fetchAllStores();
  }, []);

  const fetchAllStores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Obtener todas las cuentas
      const accountsResponse = await axios.get(`${API}/super-admin/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Crear mapa de accounts por ID
      const accountsMap = {};
      accountsResponse.data.forEach(acc => {
        accountsMap[acc.id] = acc;
      });
      setAccounts(accountsMap);
      
      // Extraer todas las tiendas de todas las cuentas
      const allStores = [];
      accountsResponse.data.forEach(account => {
        if (account.stores && account.stores.length > 0) {
          account.stores.forEach(store => {
            allStores.push({
              ...store,
              account_id: account.id,
              account_name: account.business_name,
              account_owner: account.owner_email
            });
          });
        }
      });
      
      setStores(allStores);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Error al cargar tiendas');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStore = (store) => {
    setEditingStore(store);
    setEditForm({ name: store.name, code: store.code || '' });
    setShowEditModal(true);
  };

  const handleSaveStore = async () => {
    if (!editForm.name.trim()) {
      toast.error('El nombre de la tienda es requerido');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const account = accounts[editingStore.account_id];
      
      // Actualizar stores del account
      const updatedStores = account.stores.map(s => 
        s.id === editingStore.id 
          ? { ...s, name: editForm.name, code: editForm.code }
          : s
      );
      
      await axios.put(
        `${API}/super-admin/accounts/${editingStore.account_id}`,
        { stores: updatedStores },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Tienda actualizada exitosamente');
      setShowEditModal(false);
      fetchAllStores();
    } catch (error) {
      console.error('Error updating store:', error);
      toast.error('Error al actualizar tienda');
    }
  };

  const handleDeleteStore = async (store) => {
    if (!confirm(`¿Eliminar la tienda "${store.name}"?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      const account = accounts[store.account_id];
      
      // No permitir eliminar si es la única tienda
      if (account.stores.length === 1) {
        toast.error('No puedes eliminar la única tienda de la cuenta');
        return;
      }
      
      // Filtrar stores
      const updatedStores = account.stores.filter(s => s.id !== store.id);
      
      await axios.put(
        `${API}/super-admin/accounts/${store.account_id}`,
        { stores: updatedStores },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Tienda eliminada exitosamente');
      fetchAllStores();
    } catch (error) {
      console.error('Error deleting store:', error);
      toast.error('Error al eliminar tienda');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all font-bold mb-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Panel Admin
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-8 h-8 text-slate-900" />
            <h1 className="text-4xl font-black text-slate-900">Gestión de Tiendas</h1>
          </div>
          <p className="text-slate-600">Todas las tiendas del sistema organizadas por cuenta</p>
        </div>

        {/* Stores Table */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden"
          style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr className="border-b-2 border-slate-900">
                  <th className="text-left py-4 px-6 font-bold">Nombre Tienda</th>
                  <th className="text-left py-4 px-6 font-bold">Cuenta Vinculada</th>
                  <th className="text-left py-4 px-6 font-bold">Propietario</th>
                  <th className="text-left py-4 px-6 font-bold">Fecha Creación</th>
                  <th className="text-center py-4 px-6 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      Cargando tiendas...
                    </td>
                  </tr>
                ) : stores.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      No hay tiendas registradas
                    </td>
                  </tr>
                ) : (
                  stores.map((store, index) => (
                    <tr key={`${store.account_id}-${store.id}`} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-slate-600" />
                          <span className="font-bold">{store.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-600" />
                          <span>{store.account_name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {store.account_owner}
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {new Date(store.created_at || Date.now()).toLocaleDateString('es-CL')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditStore(store)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteStore(store)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                            disabled={accounts[store.account_id]?.stores?.length === 1}
                          >
                            <Trash2 className={`w-4 h-4 ${accounts[store.account_id]?.stores?.length === 1 ? 'text-slate-300' : 'text-red-600'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white border-4 border-slate-900 rounded-2xl p-8 max-w-lg w-full"
              style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
            >
              <h2 className="text-2xl font-black mb-6">Editar Tienda</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-bold mb-2">Nombre de la Tienda *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="Ej: Tienda Centro"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-2">Código (Opcional)</label>
                  <input
                    type="text"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="Ej: TC001"
                  />
                </div>

                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <strong>Cuenta:</strong> {editingStore?.account_name}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveStore}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-blue-600"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TiendasGlobalesPage;
