import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Home, Settings as SettingsIcon, Save, User, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SettingsPage = () => {
  const navigate = useNavigate();
  const { refreshSettings } = useSettings();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('stores'); // 'stores' or 'profile'
  
  // Store settings
  const [storeAName, setStoreAName] = useState('Tienda A');
  const [storeBName, setStoreBName] = useState('Tienda B');
  
  // Profile settings
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
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
      
      // If changing password, validate and include
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
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al actualizar perfil';
      toast.error(errorMsg);
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
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
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="back-to-dashboard-btn"
          >
            <Home className="w-5 h-5" />
            Volver al Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
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
            Configuración de Tiendas
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
        </div>

        {/* Store Settings Tab */}
        {activeTab === 'stores' && (
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
            data-testid="stores-settings"
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
                  data-testid="store-a-name-input"
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
                  data-testid="store-b-name-input"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl font-bold hover:bg-[#c5e196] disabled:opacity-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="save-stores-btn"
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
            data-testid="profile-settings"
          >
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-slate-900">Mi Perfil</h2>
            </div>
            
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Name */}
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
                  data-testid="profile-name-input"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl font-medium bg-slate-50 cursor-not-allowed"
                  disabled
                  data-testid="profile-email-input"
                />
                <p className="text-xs text-slate-500 mt-1">
                  El email no se puede modificar
                </p>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-slate-200 my-6 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  Cambiar Contraseña (Opcional)
                </h3>
              </div>

              {/* Current Password */}
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
                  data-testid="current-password-input"
                />
              </div>

              {/* New Password */}
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
                  data-testid="new-password-input"
                />
              </div>

              {/* Confirm Password */}
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
                  data-testid="confirm-password-input"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl font-bold hover:bg-[#c5e196] disabled:opacity-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid="save-profile-btn"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
