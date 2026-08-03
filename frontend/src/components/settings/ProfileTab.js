import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { User, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfileTab = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [sessionDuration, setSessionDuration] = useState(168);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

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

      // Actualizar perfil de usuario
      await axios.put(`${API}/auth/update-profile`, updateData);
      
      // Actualizar configuración de duración de sesión
      await axios.put(`${API}/settings`, {
        session_duration_hours: sessionDuration
      });

      toast.success('Perfil actualizado exitosamente');
      setCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
      
      // Recargar settings
      refreshSettings();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al actualizar perfil';
      toast.error(errorMsg);
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
            ⏱️ Duración de Sesión
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Configura por cuánto tiempo deseas permanecer conectado sin tener que iniciar sesión nuevamente.
          </p>
          
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Tiempo de Sesión
          </label>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(parseInt(e.target.value))}
            className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value={8}>8 horas</option>
            <option value={12}>12 horas</option>
            <option value={24}>1 día (24 horas)</option>
            <option value={168}>1 semana (recomendado)</option>
            <option value={720}>1 mes (30 días)</option>
            <option value={8760}>1 año (365 días)</option>
          </select>
          <p className="text-xs text-slate-500 mt-2">
            💡 Por seguridad, recomendamos 1 semana. Los cambios se aplicarán en tu próximo inicio de sesión.
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
  );
};

export default ProfileTab;
