import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Home, Settings as SettingsIcon, Save, User, Store, Users, Plus, Edit2, Trash2, X, Database, AlertTriangle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useStores } from '../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ROLES = [
  { value: 'super_admin', label: 'Super-Admin' },
  { value: 'account_admin', label: 'Supervisor' },
  { value: 'employee', label: 'Empleado' },
  // Legacy roles (mantener para compatibilidad)
  { value: 'admin', label: 'Administrador' },
  { value: 'operator', label: 'Operador' }
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSettings } = useSettings();
  const { user, logout } = useAuth();
  const { stores, loading: storesLoading } = useStores(); // Hook para obtener tiendas dinámicas
  const [activeTab, setActiveTab] = useState('stores'); // 'stores', 'profile', 'users', or 'database'
  
  // Database reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [resetCredentials, setResetCredentials] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Soft Reset
  const [showSoftResetModal, setShowSoftResetModal] = useState(false);
  const [softResetPassword, setSoftResetPassword] = useState('');
  const [softResetOptions, setSoftResetOptions] = useState({
    sales: false,
    users: false,
    inventory_a: false,
    inventory_b: false,
    customers: false
  });
  
  // Database validation
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [validating, setValidating] = useState(false);
  
  // Store settings - Dinámico basado en useStores
  const [storeNames, setStoreNames] = useState({});
  
  // Account info para validar límites
  const [accountInfo, setAccountInfo] = useState(null);
  
  // Profile settings
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  
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
  
  // Estados para super-admin
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountForReset, setSelectedAccountForReset] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Establecer pestaña por defecto según el rol y parámetros URL
  useEffect(() => {
    // Verificar si hay parámetro de tab en la URL
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
      return;
    }

    // Si no hay parámetro, usar valor por defecto según rol
    if (user) {
      if (user.role === 'employee') {
        setActiveTab('profile');
      } else if (user.role === 'super_admin' || user.role === 'account_admin') {
        setActiveTab('profile'); // Mi Perfil es primera pestaña ahora
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Inicializar nombres de tiendas desde useStores
  useEffect(() => {
    if (stores && stores.length > 0) {
      const names = {};
      stores.forEach(store => {
        names[store.id] = store.name;
      });
      setStoreNames(names);
    }
  }, [stores]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
      
      // Cargar cuentas si es super-admin
      if (user.role === 'super_admin') {
        fetchAccounts();
      }
      
      if (user.role === 'admin' || user.role === 'account_admin' || user.role === 'super_admin') {
        fetchUsers();
        // Cargar info de cuenta para validar límites
        if (user.role === 'account_admin') {
          fetchAccountInfo();
        }
      }
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/super-admin/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Error al cargar cuentas');
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

  const fetchAccountInfo = async () => {
    try {
      const response = await axios.get(`${API}/account/info`);
      setAccountInfo(response.data);
    } catch (error) {
      console.error('Error fetching account info:', error);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = { name: profileName };
      
      if (profileNewPassword || profileConfirmPassword) {
        if (profileNewPassword !== profileConfirmPassword) {
          toast.error('Las contraseñas no coinciden');
          setSaving(false);
          return;
        }
        if (profileNewPassword.length < 6) {
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
        updateData.new_password = profileNewPassword;
      }

      await axios.put(`${API}/auth/update-profile`, updateData);

      toast.success('Perfil actualizado exitosamente');
      setCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al actualizar perfil';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenUserModal = (user = null) => {
    // Si es nuevo usuario (no es edición), validar límite
    if (!user && accountInfo) {
      // Contar empleados actuales (excluyendo account_admin)
      const currentEmployees = users.filter(u => 
        u.role === 'supervisor' || u.role === 'employee'
      ).length;
      
      const maxEmployees = accountInfo.max_employees || 0;
      
      if (currentEmployees >= maxEmployees) {
        toast.error(`Has alcanzado el límite de ${maxEmployees} empleados para tu plan`);
        return;
      }
    }
    
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
        role: 'employee',
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

  const handleHardReset = async () => {
    if (resetConfirmation !== 'RESETEAR') {
      toast.error('Debes escribir "RESETEAR" para confirmar');
      return;
    }
    
    if (!adminPassword) {
      toast.error('Debes ingresar tu contraseña actual');
      return;
    }
    
    if (!newPassword) {
      toast.error('Debes ingresar la nueva contraseña');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    
    // Si es super-admin, debe seleccionar una cuenta
    if (user?.role === 'super_admin' && !selectedAccountForReset) {
      toast.error('Debes seleccionar una cuenta para resetear');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
        setSaving(false);
        return;
      }

      const response = await axios.post(
        `${API}/database/hard-reset`,
        { 
          password: adminPassword,
          new_password: newPassword,
          account_id: user?.role === 'super_admin' ? selectedAccountForReset : undefined
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Guardar credenciales para mostrarlas
      setResetCredentials(response.data.admin_credentials);
      setShowResetModal(false);
      setShowCredentialsModal(true);
      setAdminPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetConfirmation('');
      
      toast.success('Base de datos reseteada exitosamente');
      
      // Hacer logout después de 10 segundos
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 10000);
      
    } catch (error) {
      console.error('Error during hard reset:', error);
      
      // Extraer mensaje de error apropiado
      let errorMsg = 'Error al resetear base de datos';
      
      if (error.response?.status === 401) {
        errorMsg = 'Contraseña incorrecta';
      } else if (error.response?.status === 404) {
        errorMsg = 'Endpoint no encontrado. Verifica que el backend esté actualizado.';
      } else if (error.response?.status === 403) {
        errorMsg = 'No tienes permisos para realizar esta acción.';
      } else if (error.response?.data) {
        // Manejar diferentes formatos de error
        const data = error.response.data;
        
        if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          // Error de validación de Pydantic
          errorMsg = data.detail.map(err => err.msg || JSON.stringify(err)).join(', ');
        } else if (data.message) {
          errorMsg = data.message;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setSaving(false);
      setResetConfirmation('');
      setAdminPassword('');
    }
  };


  const handleSoftReset = async () => {
    // Validar que al menos una opción esté seleccionada
    const hasSelection = Object.values(softResetOptions).some(val => val === true);
    if (!hasSelection) {
      toast.error('Debes seleccionar al menos una opción para resetear');
      return;
    }
    
    if (!softResetPassword) {
      toast.error('Debes ingresar tu contraseña para confirmar');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No hay sesión activa');
        setSaving(false);
        return;
      }

      const response = await axios.post(
        `${API}/database/soft-reset`,
        {
          password: softResetPassword,
          account_id: user?.role === 'super_admin' ? selectedAccountForReset : undefined,
          ...softResetOptions
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { deleted_counts } = response.data;
      
      // Mostrar resumen de lo eliminado
      let summary = 'Elementos eliminados:\n';
      if (deleted_counts.sales) summary += `- Ventas: ${deleted_counts.sales}\n`;
      if (deleted_counts.users) summary += `- Usuarios: ${deleted_counts.users}\n`;
      if (deleted_counts.inventory_a) summary += `- Productos Tienda A: ${deleted_counts.inventory_a}\n`;
      if (deleted_counts.inventory_b) summary += `- Productos Tienda B: ${deleted_counts.inventory_b}\n`;
      if (deleted_counts.customers) summary += `- Clientes: ${deleted_counts.customers}\n`;
      
      toast.success(summary);
      
      // Resetear opciones
      setSoftResetOptions({
        sales: false,
        users: false,
        inventory_a: false,
        inventory_b: false,
        customers: false
      });
      setSoftResetPassword('');
      
      setShowSoftResetModal(false);
      
      // Refrescar la página para actualizar los datos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error durante soft reset:', error);
      
      // Extraer mensaje de error
      let errorMsg = 'Error al hacer soft reset';
      
      if (error.response?.status === 401) {
        errorMsg = 'Contraseña incorrecta';
      } else if (error.response?.data) {
        const data = error.response.data;
        
        if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg || JSON.stringify(err)).join(', ');
        } else if (data.message) {
          errorMsg = data.message;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };


  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const handleValidateSchema = async () => {
    setValidating(true);
    setValidationReport(null);

    try {
      // Asegurarse de que el token esté presente
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
        return;
      }

      const response = await axios.post(
        `${API}/database/validate-and-fix`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setValidationReport(response.data);
      setShowValidationModal(true);
      
      if (response.data.status === 'fixed') {
        toast.success('Esquema corregido exitosamente');
      } else {
        toast.success('Esquema validado - Todo correcto');
      }
    } catch (error) {
      console.error('Error validating schema:', error);
      
      if (error.response?.status === 404) {
        toast.error('Endpoint no encontrado. Verifica que el backend esté actualizado.');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('No tienes permisos para realizar esta acción.');
      } else {
        const errorMsg = error.response?.data?.detail || error.message || 'Error al validar esquema';
        toast.error(errorMsg);
      }
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }

  // Determinar permisos según rol
  const isSuperAdmin = user?.role === 'super_admin';
  const isSupervisor = user?.role === 'account_admin'; // Supervisor
  const canManageEmployees = isSupervisor; // Solo Supervisor puede gestionar empleados
  const canAccessDatabase = isSuperAdmin; // Solo Super-Admin ve Base de Datos
  const canAccessAllUsers = isSuperAdmin; // Solo Super-Admin ve todos los usuarios

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
          {/* Mi Perfil - Visible para todos (PRIMERA POSICIÓN) */}
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
          
          {/* Tiendas - Solo para Super-Admin y Supervisor */}
          {/* Tiendas - Solo para Supervisor (NO para super_admin) */}
          {isSupervisor && !isSuperAdmin && (
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
          )}
          
          {/* Gestión de Empleados - Solo para Supervisor */}
          {isSupervisor && (
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'employees' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              data-testid="employees-tab-btn"
            >
              <Users className="w-5 h-5" />
              Gestión de Empleados
            </button>
          )}
        </div>

        {/* Store Settings Tab - Solo para Supervisor (NO super_admin) - SOLO LECTURA */}
        {activeTab === 'stores' && isSupervisor && !isSuperAdmin && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Store className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-slate-900">Tiendas de la Cuenta</h2>
            </div>
            
            <p className="text-sm text-slate-600 mb-6">
              Estas son las tiendas asignadas a tu cuenta. Para agregar o modificar tiendas, contacta al administrador del sistema.
            </p>
            
            {stores && stores.length > 0 ? (
              <div className="space-y-4">
                {stores.map((store, index) => (
                  <div 
                    key={store.id}
                    className="p-4 border-2 border-slate-200 rounded-xl bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{store.name}</p>
                        <p className="text-sm text-slate-600">Código: {store.code}</p>
                      </div>
                      {index === 0 && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded-full">
                          Por Defecto
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-600">
                <Store className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p>No hay tiendas configuradas para tu cuenta.</p>
                <p className="text-sm mt-2">Contacta al administrador del sistema.</p>
              </div>
            )}
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
                  value={profileNewPassword}
                  onChange={(e) => setProfileNewPassword(e.target.value)}
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
                  value={profileConfirmPassword}
                  onChange={(e) => setProfileConfirmPassword(e.target.value)}
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

        {/* Employee Management Tab (Supervisor Only) - Gestión de usuarios de su cuenta */}
        {activeTab === 'employees' && isSupervisor && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <h2 className="text-2xl font-bold text-slate-900">Gestión de Empleados</h2>
              </div>
              <button
                onClick={() => handleOpenUserModal()}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl font-bold hover:bg-[#c5e196] transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="add-employee-btn"
              >
                <Plus className="w-5 h-5" />
                Nuevo Empleado
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
              <p className="text-center text-slate-500 py-8">No hay empleados registrados</p>
            )}
          </div>
        )}

        {/* User Management Tab (Super-Admin Only) - Vista global de todos los usuarios */}
        {activeTab === 'users' && isSuperAdmin && (
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

        {/* Database Management Tab (Super-Admin Only) */}
        {activeTab === 'database' && isSuperAdmin && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-slate-900">Gestión de Base de Datos</h2>
            </div>

            {/* Warning Section */}
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-red-900 mb-2">
                    ⚠️ Zona de Peligro
                  </h3>
                  <p className="text-sm text-red-800 mb-3">
                    El <strong>Hard Reset</strong> es una operación destructiva que:
                  </p>
                  <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
                    <li>Borrará TODOS los datos de la base de datos</li>
                    <li>Eliminará todos los usuarios, productos, ventas, gastos e ingresos</li>
                    <li>Eliminará todos los clientes y notas del sistema</li>
                    <li>Creará un nuevo usuario administrador con credenciales aleatorias</li>
                    <li>Esta acción NO SE PUEDE DESHACER</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Schema Validation Section */}
            <div className="border-2 border-blue-500 bg-blue-50 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                🔍 Validar y Corregir Esquema
              </h3>
              <p className="text-slate-600 mb-4">
                Verifica la estructura de la base de datos y crea automáticamente tablas, 
                índices o campos faltantes. Esta operación es <strong>segura</strong> y no 
                elimina datos existentes.
              </p>
              
              <div className="bg-white border-2 border-slate-900 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-slate-900 mb-2">Esta acción:</h4>
                <ul className="text-sm text-slate-700 space-y-1 ml-4 list-disc">
                  <li>✅ Detecta colecciones faltantes y las crea</li>
                  <li>✅ Crea índices necesarios para optimización</li>
                  <li>✅ Inicializa el documento de configuración si no existe</li>
                  <li>✅ NO elimina ni modifica datos existentes</li>
                  <li>✅ Genera un reporte detallado de cambios realizados</li>
                </ul>
              </div>
              
              <button
                onClick={handleValidateSchema}
                disabled={validating}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="validate-schema-btn"
              >
                <Database className="w-5 h-5" />
                {validating ? 'Validando...' : 'Validar y Corregir Esquema'}
              </button>
            </div>

            {/* Hard Reset Section */}
            <div className="border-2 border-slate-900 rounded-xl p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Hard Reset de Base de Datos
              </h3>
              <p className="text-slate-600 mb-4">
                Utiliza esta opción solo si necesitas reiniciar completamente el sistema.
                Se creará un nuevo usuario administrador y recibirás las credenciales en pantalla.
              </p>
              
              <button
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-red-700 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="hard-reset-btn"
              >
                <Database className="w-5 h-5" />
                Ejecutar Hard Reset
              </button>
            </div>

            {/* Soft Reset Section */}
            <div className="border-2 border-slate-900 rounded-xl p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Soft Reset Selectivo
              </h3>
              <p className="text-slate-600 mb-4">
                Elimina datos específicos sin afectar el resto del sistema.
                Selecciona qué deseas resetear.
              </p>
              
              <button
                onClick={() => setShowSoftResetModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-orange-600 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="soft-reset-btn"
              >
                <Database className="w-5 h-5" />
                Ejecutar Soft Reset
              </button>
            </div>
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

        {/* Hard Reset Confirmation Modal */}
        {showResetModal && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowResetModal(false)}
          >
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-md w-full"
              style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  ⚠️ Confirmar Hard Reset
                </h3>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-900 font-bold mb-2">
                  Esta acción borrará TODA la información de la base de datos
                </p>
                <ul className="text-xs text-red-800 space-y-1 ml-4 list-disc">
                  <li>Todos los usuarios (excepto el nuevo admin)</li>
                  <li>Todos los productos e inventario</li>
                  <li>Todas las ventas registradas</li>
                  <li>Todos los gastos e ingresos</li>
                  <li>Todos los clientes del CRM</li>
                  <li>Todas las notas y calendario</li>
                </ul>
              </div>

              {/* Selector de cuenta (solo para super-admin) */}
              {user?.role === 'super_admin' && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Cuenta a Resetear *
                  </label>
                  <select
                    value={selectedAccountForReset}
                    onChange={(e) => setSelectedAccountForReset(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                    required
                  >
                    <option value="">Selecciona una cuenta...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.business_name} ({acc.plan}) - {acc.stores?.length || 0} tiendas
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-600 mt-1">
                    ⚠️ Se eliminarán TODOS los datos de esta cuenta
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Contraseña Actual del Administrador *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Tu contraseña actual"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nueva Contraseña Asignada *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nueva contraseña (mín. 8 caracteres)"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Repetir Nueva Contraseña *
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirma la nueva contraseña"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Para confirmar, escribe: <span className="text-red-600">RESETEAR</span>
                </label>
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Escribe RESETEAR"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmation('');
                    setAdminPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  className="flex-1 px-4 py-2 border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleHardReset}
                  disabled={saving || resetConfirmation !== 'RESETEAR' || !adminPassword || !newPassword || !confirmNewPassword}
                  className="flex-1 px-4 py-2 bg-red-600 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  {saving ? 'Reseteando...' : 'Confirmar Reset'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Display Modal */}
        {showCredentialsModal && resetCredentials && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-lg w-full"
              style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Database className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    ✅ Base de Datos Reseteada
                  </h3>
                  <p className="text-sm text-slate-600">
                    Guarda estas credenciales ahora
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-4 mb-4">
                <p className="text-sm font-bold text-yellow-900 mb-2">
                  ⚠️ {resetCredentials.warning}
                </p>
                <p className="text-xs text-yellow-800">
                  Copia estas credenciales antes de cerrar esta ventana. 
                  Serás desconectado en 10 segundos.
                </p>
              </div>

              <div className="space-y-3 mb-4">
                <div className="border-2 border-slate-900 rounded-lg p-4">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    EMAIL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono font-bold text-slate-900">
                      {resetCredentials.email}
                    </code>
                    <button
                      onClick={() => copyToClipboard(resetCredentials.email)}
                      className="px-3 py-1 bg-slate-100 border border-slate-900 rounded-lg text-xs font-bold hover:bg-slate-200"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="border-2 border-slate-900 rounded-lg p-4 bg-green-50">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    CONTRASEÑA
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono font-bold text-green-900">
                      {resetCredentials.password}
                    </code>
                    <button
                      onClick={() => copyToClipboard(resetCredentials.password)}
                      className="px-3 py-1 bg-green-600 text-white border border-slate-900 rounded-lg text-xs font-bold hover:bg-green-700"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    copyToClipboard(`Email: ${resetCredentials.email}\nContraseña: ${resetCredentials.password}`);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-900 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-800 transition-colors"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  Copiar Todo
                </button>
                <button
                  onClick={() => {
                    setShowCredentialsModal(false);
                    logout();
                    navigate('/login');
                  }}
                  className="px-4 py-3 border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cerrar e Ir al Login
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Soft Reset Modal */}
        {showSoftResetModal && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowSoftResetModal(false);
              setSoftResetPassword('');
            }}
          >
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-lg w-full"
              style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  🔄 Soft Reset Selectivo
                </h3>
                <button
                  onClick={() => setShowSoftResetModal(false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-900 font-bold mb-2">
                  Selecciona qué datos deseas eliminar
                </p>
                <p className="text-xs text-orange-800">
                  Los elementos seleccionados se eliminarán permanentemente
                </p>
              </div>

              {/* Selector de cuenta (solo para super-admin) */}
              {user?.role === 'super_admin' && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Cuenta a Resetear *
                  </label>
                  <select
                    value={selectedAccountForReset}
                    onChange={(e) => setSelectedAccountForReset(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                    required
                  >
                    <option value="">Selecciona una cuenta...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.business_name} ({acc.plan})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Password Field */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Contraseña Actual del Administrador *
                </label>
                <input
                  type="password"
                  value={softResetPassword}
                  onChange={(e) => setSoftResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ingresa tu contraseña"
                  autoFocus
                />
              </div>

              <div className="space-y-3 mb-6">
                {/* Ventas */}
                <label className="flex items-center gap-3 p-3 border-2 border-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={softResetOptions.sales}
                    onChange={(e) => setSoftResetOptions({...softResetOptions, sales: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Ventas</div>
                    <div className="text-xs text-slate-600">Eliminar todas las ventas registradas</div>
                  </div>
                </label>

                {/* Usuarios */}
                <label className="flex items-center gap-3 p-3 border-2 border-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={softResetOptions.users}
                    onChange={(e) => setSoftResetOptions({...softResetOptions, users: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Usuarios</div>
                    <div className="text-xs text-slate-600">Eliminar todos los usuarios (excepto admin)</div>
                  </div>
                </label>

                {/* Inventario Tienda A */}
                <label className="flex items-center gap-3 p-3 border-2 border-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={softResetOptions.inventory_a}
                    onChange={(e) => setSoftResetOptions({...softResetOptions, inventory_a: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Inventario Tienda A</div>
                    <div className="text-xs text-slate-600">Eliminar todos los productos de Tienda A</div>
                  </div>
                </label>

                {/* Inventario Tienda B */}
                <label className="flex items-center gap-3 p-3 border-2 border-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={softResetOptions.inventory_b}
                    onChange={(e) => setSoftResetOptions({...softResetOptions, inventory_b: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Inventario Tienda B</div>
                    <div className="text-xs text-slate-600">Eliminar todos los productos de Tienda B</div>
                  </div>
                </label>

                {/* Clientes */}
                <label className="flex items-center gap-3 p-3 border-2 border-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={softResetOptions.customers}
                    onChange={(e) => setSoftResetOptions({...softResetOptions, customers: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Clientes</div>
                    <div className="text-xs text-slate-600">Eliminar todos los clientes del CRM</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSoftResetModal(false);
                    setSoftResetPassword('');
                    setSoftResetOptions({
                      sales: false,
                      users: false,
                      inventory_a: false,
                      inventory_b: false,
                      customers: false
                    });
                  }}
                  className="flex-1 px-4 py-2 border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSoftReset}
                  disabled={saving || !softResetPassword || !Object.values(softResetOptions).some(v => v === true)}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  {saving ? 'Reseteando...' : 'Confirmar Reset'}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Schema Validation Report Modal */}
        {showValidationModal && validationReport && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowValidationModal(false)}
          >
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  {validationReport.status === 'fixed' ? '🔧 Esquema Corregido' : '✅ Esquema Validado'}
                </h3>
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className={`border-2 ${validationReport.status === 'fixed' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'} rounded-lg p-4 mb-4`}>
                <p className="font-bold text-slate-900 mb-2">
                  {validationReport.message}
                </p>
                <p className="text-sm text-slate-600">
                  Timestamp: {new Date(validationReport.timestamp).toLocaleString('es-ES')}
                </p>
              </div>

              {/* Collections Created */}
              {validationReport.collections_created.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-bold text-slate-900 mb-2">
                    📦 Colecciones Creadas ({validationReport.collections_created.length})
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <ul className="space-y-1">
                      {validationReport.collections_created.map((coll, idx) => (
                        <li key={idx} className="text-sm text-slate-700">
                          • <code className="bg-slate-200 px-2 py-0.5 rounded">{coll}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Indexes Created */}
              {validationReport.indexes_created.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-bold text-slate-900 mb-2">
                    🔍 Índices Creados ({validationReport.indexes_created.length})
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                    <ul className="space-y-2">
                      {validationReport.indexes_created.map((idx, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          • <code className="bg-slate-200 px-2 py-0.5 rounded">{idx.collection}</code>
                          {' '} → {' '}
                          <code className="bg-blue-100 px-2 py-0.5 rounded">{idx.field}</code>
                          {idx.unique && <span className="ml-2 text-xs bg-yellow-200 px-2 py-0.5 rounded">UNIQUE</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Settings Initialized */}
              {validationReport.settings_initialized && (
                <div className="mb-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-900">
                      ⚙️ <strong>Documento de configuración inicializado</strong> con valores por defecto
                    </p>
                  </div>
                </div>
              )}

              {/* Errors */}
              {validationReport.errors && validationReport.errors.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-bold text-red-900 mb-2">
                    ⚠️ Errores Encontrados ({validationReport.errors.length})
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <ul className="space-y-1">
                      {validationReport.errors.map((err, idx) => (
                        <li key={idx} className="text-sm text-red-800">
                          • {err.collection || 'General'}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="border-t-2 border-slate-200 pt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-100 p-3 rounded-lg">
                    <p className="text-slate-600">Colecciones verificadas</p>
                    <p className="text-2xl font-bold text-slate-900">{validationReport.collections_checked}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <p className="text-slate-600">Cambios realizados</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {validationReport.collections_created.length + validationReport.indexes_created.length + (validationReport.settings_initialized ? 1 : 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="px-6 py-3 bg-slate-900 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-800 transition-colors"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
