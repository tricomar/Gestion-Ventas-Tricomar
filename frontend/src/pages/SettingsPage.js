import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Home, Settings as SettingsIcon, Save, User, Store, Users, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'sub_admin', label: 'Sub-Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'empleado', label: 'Empleado' }
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { refreshSettings } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('stores'); // 'stores', 'profile', or 'users'
  
  // Store settings
  const [storeAName, setStoreAName] = useState('Tienda A');
  const [storeBName, setStoreBName] = useState('Tienda B');
  
  // Profile settings
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // User management
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'empleado',
    password: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
      if (user.role === 'admin') {
        fetchUsers();
      }
    }
  }, [user]);

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

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    }
  };

  const handleSaveStores = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.put(`${API}/settings`, {
        store_a_name: storeAName,
        store_b_name: storeBName
      });

      toast.success('Configuración de tiendas guardada');
      refreshSettings();
    } catch (error) {
      toast.error('Error al guardar configuración');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = { name: profileName };
      
      if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          toast.error('Las contraseñas no coinciden');
          setSaving(false);
          return;
        }
        if (newPassword.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          setSaving(false);
          return;
        }
        if (!currentPassword) {
          toast.error('Ingresa tu contraseña actual');
          setSaving(false);
          return;
        }
        
        updateData.current_password = currentPassword;
        updateData.new_password = newPassword;
      }

      await axios.put(`${API}/auth/update-profile`, updateData);

      toast.success('Perfil actualizado exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al actualizar perfil';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        role: user.role,
        password: ''
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: '',
        email: '',
        role: 'empleado',
        password: ''
      });
    }
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({ name: '', email: '', role: 'empleado', password: '' });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        // Update existing user
        await axios.put(`${API}/users/${editingUser.id}`, userForm);
        toast.success('Usuario actualizado exitosamente');
      } else {
        // Create new user
        if (!userForm.password) {
          toast.error('La contraseña es requerida para nuevos usuarios');
          setSaving(false);
          return;
        }
        await axios.post(`${API}/users`, userForm);
        toast.success('Usuario creado exitosamente');
      }
      
      handleCloseUserModal();
      fetchUsers();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al guardar usuario';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${userName}"?`)) return;

    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success('Usuario eliminado exitosamente');
      fetchUsers();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al eliminar usuario';
      toast.error(errorMsg);
    }
  };

  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 
              className="text-4xl font-black text-slate-900 mb-2"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
            >
              Configuración
            </h1>
            <p className="text-slate-600">Personaliza tu aplicación</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="back-to-dashboard-btn"
          >
            <Home className="w-5 h-5" />
            Volver al Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('stores')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
              activeTab === 'stores' 
                ? 'bg-slate-900 text-white' 
                : 'bg-white text-slate-900 hover:bg-slate-50'
            }`}
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="stores-tab-btn"
          >
            <Store className="w-5 h-5" />
            Tiendas
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
              activeTab === 'profile' 
                ? 'bg-slate-900 text-white' 
                : 'bg-white text-slate-900 hover:bg-slate-50'
            }`}
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="profile-tab-btn"
          >
            <User className="w-5 h-5" />
            Mi Perfil
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'users' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              data-testid="users-tab-btn"
            >
              <Users className="w-5 h-5" />
              Gestión de Usuarios
            </button>
          )}
        </div>

        {/* Store Settings Tab */}
        {activeTab === 'stores' && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Store className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-slate-900">Nombres de Tiendas</h2>
            </div>
            
            <form onSubmit={handleSaveStores} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nombre Tienda A
                </label>
                <input
                  type="text"
                  value={storeAName}
                  onChange={(e) => setStoreAName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nombre Tienda B
                </label>
                <input
                  type="text"
                  value={storeBName}
                  onChange={(e) => setStoreBName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                  maxLength={50}
                />
              </div>

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
          </div>
        )}

        {/* Profile Settings Tab */}
        {activeTab === 'profile' && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-slate-900">Mi Perfil</h2>
            </div>
            
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl font-medium bg-slate-50 cursor-not-allowed"
                  disabled
                />
                <p className="text-xs text-slate-500 mt-1">
                  El email no se puede modificar aquí
                </p>
              </div>

              <div className="border-t-2 border-slate-200 my-6 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  Cambiar Contraseña (Opcional)
                </h3>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Ingresa tu contraseña actual"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Repite la nueva contraseña"
                />
              </div>

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
          </div>
        )}

        {/* User Management Tab (Admin Only) */}
        {activeTab === 'users' && isAdmin && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <h2 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h2>
              </div>
              <button
                onClick={() => handleOpenUserModal()}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl font-bold hover:bg-[#c5e196] transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="add-user-btn"
              >
                <Plus className="w-5 h-5" />
                Nuevo Usuario
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-3 px-4 font-bold text-slate-900">Nombre</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-900">Email</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-900">Perfil</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-900">Fecha Creación</th>
                    <th className="text-center py-3 px-4 font-bold text-slate-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-3 px-4">{u.name}</td>
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-900' :
                          u.role === 'sub_admin' ? 'bg-blue-100 text-blue-900' :
                          u.role === 'supervisor' ? 'bg-green-100 text-green-900' :
                          'bg-slate-100 text-slate-900'
                        }`}>
                          {ROLES.find(r => r.value === u.role)?.label || u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(u.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenUserModal(u)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            data-testid={`edit-user-${u.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {u.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                              data-testid={`delete-user-${u.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <p className="text-center text-slate-500 py-8">No hay usuarios registrados</p>
            )}
          </div>
        )}

        {/* User Modal */}
        {showUserModal && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseUserModal}
          >
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-md w-full"
              style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <button
                  onClick={handleCloseUserModal}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Perfil
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Contraseña {editingUser && '(dejar vacío para no cambiar)'}
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required={!editingUser}
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseUserModal}
                    className="flex-1 px-4 py-2 border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg font-bold hover:bg-[#c5e196] disabled:opacity-50 transition-colors"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
