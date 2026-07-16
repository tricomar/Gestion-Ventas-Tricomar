import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Users, Store, Settings, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MODULES = {
  sales: "Ventas",
  inventory: "Inventario",
  expenses: "Egresos",
  income: "Otros Ingresos",
  customers: "CRM Clientes",
  notes: "Notas y Calendario",
  reports: "Registros Históricos",
  indicators: "Indicadores Económicos"
};

const PLANS = {
  free: { name: "Gratuito", color: "bg-slate-500" },
  subscribed: { name: "Suscrito", color: "bg-blue-500" }
};

const SuperAdminPage = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // info, stores, users
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'

  // Form states para editar cuenta
  const [editForm, setEditForm] = useState({
    plan: '',
    max_stores: 1,
    max_employees: 0,
    enabled_modules: [],
    status: 'active'
  });

  // Form para agregar/editar tienda
  const [newStore, setNewStore] = useState({ name: '', code: '' });
  const [editingStore, setEditingStore] = useState(null);
  
  // Form para agregar/editar empleado
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee'
  });
  
  // Modal confirmación eliminar cuenta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/super-admin/accounts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  };

  const selectAccount = async (accountId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/super-admin/accounts/${accountId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setSelectedAccount(response.data);
      setEditForm({
        plan: response.data.plan,
        max_stores: response.data.max_stores,
        max_employees: response.data.max_employees,
        enabled_modules: response.data.enabled_modules || [],
        status: response.data.status
      });
      setActiveTab('info');
    } catch (error) {
      console.error('Error fetching account:', error);
      toast.error('Error al cargar cuenta');
    } finally {
      setLoading(false);
    }
  };

  const updateAccount = async () => {
    if (!selectedAccount) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API}/super-admin/accounts/${selectedAccount.id}`,
        editForm,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Cuenta actualizada exitosamente');
      await selectAccount(selectedAccount.id); // Recargar
      await fetchAccounts(); // Actualizar lista
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar cuenta');
    } finally {
      setSaving(false);
    }
  };

  const addStore = async () => {
    if (!selectedAccount || !newStore.name || !newStore.code) {
      toast.error('Completa todos los campos');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API}/super-admin/accounts/${selectedAccount.id}/stores`,
        newStore,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Tienda agregada exitosamente');
      setNewStore({ name: '', code: '' });
      await selectAccount(selectedAccount.id); // Recargar
    } catch (error) {
      console.error('Error adding store:', error);
      toast.error(error.response?.data?.detail || 'Error al agregar tienda');
    } finally {
      setSaving(false);
    }
  };

  const deleteStore = async (storeId) => {
    if (!confirm('¿Eliminar esta tienda? Esta acción no se puede deshacer.')) return;
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      await axios.delete(
        `${API}/super-admin/accounts/${selectedAccount.id}/stores/${storeId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Tienda eliminada');
      await selectAccount(selectedAccount.id); // Recargar
    } catch (error) {
      console.error('Error deleting store:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar tienda');
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (module) => {
    setEditForm(prev => ({
      ...prev,
      enabled_modules: prev.enabled_modules.includes(module)
        ? prev.enabled_modules.filter(m => m !== module)
        : [...prev.enabled_modules, module]
    }));
  };

  if (loading && !selectedAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-xl font-bold">Cargando...</div>
      </div>
    );
  }

  // Vista de lista de cuentas
  if (!selectedAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-lg hover:bg-slate-50 transition-all font-bold mb-4"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al Panel Admin
            </button>
            
            <h1 className="text-4xl font-black text-slate-900 mb-2">Panel Super-Admin</h1>
            <p className="text-slate-600">Gestiona todas las cuentas del sistema</p>
          </div>

          {/* Lista de cuentas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map(account => (
              <div
                key={account.id}
                onClick={() => selectAccount(account.id)}
                className="bg-white border-2 border-slate-900 rounded-xl p-6 cursor-pointer hover:bg-slate-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <Building2 className="w-8 h-8 text-slate-900" />
                  <span className={`px-3 py-1 ${PLANS[account.plan].color} text-white text-xs font-bold rounded-full`}>
                    {PLANS[account.plan].name}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2">{account.business_name}</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    <span>{account.stores?.length || 0} tiendas ({account.max_stores} máx)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{account.current_employees || 0} empleados ({account.max_employees} máx)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>{account.enabled_modules?.length || 0} módulos activos</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t-2 border-slate-200">
                  <span className={`text-xs font-bold ${account.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {account.status === 'active' ? '● Activa' : '● Suspendida'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista de detalle de cuenta
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => setSelectedAccount(null)}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-lg hover:bg-slate-50 transition-all font-bold mb-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a la lista
        </button>

        <div className="bg-white border-2 border-slate-900 rounded-xl p-8 mb-6"
          style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}>
          <h2 className="text-3xl font-black text-slate-900 mb-2">{selectedAccount.business_name}</h2>
          <p className="text-slate-600">ID: {selectedAccount.id}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'info', label: 'Info General', icon: Building2 },
            { id: 'limits', label: 'Límites', icon: Settings },
            { id: 'stores', label: 'Tiendas', icon: Store },
            { id: 'modules', label: 'Módulos', icon: CheckSquare },
            { id: 'users', label: 'Usuarios', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-2 border-slate-900 rounded-lg font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-slate-50'
              }`}
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white border-2 border-slate-900 rounded-xl p-8"
          style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}>
          
          {/* Tab: Info General */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Plan</label>
                <select
                  value={editForm.plan}
                  onChange={(e) => setEditForm({...editForm, plan: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="free">Gratuito</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Estado</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="active">Activa</option>
                  <option value="suspended">Suspendida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>

              <button
                onClick={updateAccount}
                disabled={saving}
                className="w-full px-6 py-3 bg-green-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}

          {/* Tab: Límites */}
          {activeTab === 'limits' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Máximo de Tiendas</label>
                <input
                  type="number"
                  min="1"
                  value={editForm.max_stores}
                  onChange={(e) => setEditForm({...editForm, max_stores: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-sm text-slate-600 mt-1">Actual: {selectedAccount.stores?.length || 0} tiendas</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Máximo de Empleados</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.max_employees}
                  onChange={(e) => setEditForm({...editForm, max_employees: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-sm text-slate-600 mt-1">Actual: {selectedAccount.current_employees || 0} empleados</p>
              </div>

              <button
                onClick={updateAccount}
                disabled={saving}
                className="w-full px-6 py-3 bg-green-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}

          {/* Tab: Tiendas */}
          {activeTab === 'stores' && (
            <div className="space-y-6">
              {/* Lista de tiendas */}
              <div className="space-y-3">
                {selectedAccount.stores?.map(store => (
                  <div key={store.id} className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-lg">
                    <div>
                      <p className="font-bold text-slate-900">{store.name}</p>
                      <p className="text-sm text-slate-600">Código: {store.code}</p>
                    </div>
                    <button
                      onClick={() => deleteStore(store.id)}
                      disabled={saving || (selectedAccount.stores?.length || 0) <= 1}
                      className="px-4 py-2 bg-red-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-red-600 disabled:opacity-50 transition-all text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>

              {/* Agregar nueva tienda */}
              {(selectedAccount.stores?.length || 0) < editForm.max_stores && (
                <div className="border-t-2 border-slate-200 pt-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Agregar Nueva Tienda</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Nombre</label>
                      <input
                        type="text"
                        value={newStore.name}
                        onChange={(e) => setNewStore({...newStore, name: e.target.value})}
                        placeholder="Sucursal Centro"
                        className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Código</label>
                      <input
                        type="text"
                        value={newStore.code}
                        onChange={(e) => setNewStore({...newStore, code: e.target.value.toUpperCase()})}
                        placeholder="B"
                        maxLength={3}
                        className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <button
                      onClick={addStore}
                      disabled={saving}
                      className="w-full px-6 py-3 bg-blue-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 transition-all"
                      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                    >
                      {saving ? 'Agregando...' : 'Agregar Tienda'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Módulos */}
          {activeTab === 'modules' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(MODULES).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-4 border-2 border-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={editForm.enabled_modules.includes(key)}
                      onChange={() => toggleModule(key)}
                      className="w-5 h-5"
                    />
                    <span className="font-bold text-slate-900">{label}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={updateAccount}
                disabled={saving}
                className="w-full px-6 py-3 bg-green-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}

          {/* Tab: Usuarios */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {selectedAccount.users?.length > 0 ? (
                selectedAccount.users.map(user => (
                  <div key={user.id} className="p-4 border-2 border-slate-200 rounded-lg">
                    <p className="font-bold text-slate-900">{user.name}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Rol: {user.role} {user.is_account_owner && '(Propietario)'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-slate-600">No hay usuarios en esta cuenta</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
