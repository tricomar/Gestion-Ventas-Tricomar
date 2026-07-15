import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Database, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DatabaseSettings = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [resetCredentials, setResetCredentials] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showSoftResetModal, setShowSoftResetModal] = useState(false);
  const [softResetPassword, setSoftResetPassword] = useState('');
  const [softResetOptions, setSoftResetOptions] = useState({
    sales: false,
    users: false,
    inventory_a: false,
    inventory_b: false,
    customers: false
  });
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

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
          new_password: newPassword
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setResetCredentials(response.data.admin_credentials);
      setShowResetModal(false);
      setShowCredentialsModal(true);
      setAdminPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetConfirmation('');
      
      toast.success('Base de datos reseteada exitosamente');
      
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 10000);
      
    } catch (error) {
      console.error('Error during hard reset:', error);
      
      let errorMsg = 'Error al resetear base de datos';
      
      if (error.response?.status === 401) {
        errorMsg = 'Contraseña incorrecta';
      } else if (error.response?.status === 404) {
        errorMsg = 'Endpoint no encontrado. Verifica que el backend esté actualizado.';
      } else if (error.response?.status === 403) {
        errorMsg = 'No tienes permisos para realizar esta acción.';
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
      setResetConfirmation('');
      setAdminPassword('');
    }
  };

  const handleSoftReset = async () => {
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
      
      let summary = 'Elementos eliminados:\n';
      if (deleted_counts.sales) summary += `- Ventas: ${deleted_counts.sales}\n`;
      if (deleted_counts.users) summary += `- Usuarios: ${deleted_counts.users}\n`;
      if (deleted_counts.inventory_a) summary += `- Productos Tienda A: ${deleted_counts.inventory_a}\n`;
      if (deleted_counts.inventory_b) summary += `- Productos Tienda B: ${deleted_counts.inventory_b}\n`;
      if (deleted_counts.customers) summary += `- Clientes: ${deleted_counts.customers}\n`;
      
      toast.success(summary);
      
      setSoftResetOptions({
        sales: false,
        users: false,
        inventory_a: false,
        inventory_b: false,
        customers: false
      });
      setSoftResetPassword('');
      
      setShowSoftResetModal(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error durante soft reset:', error);
      
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

  return (
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
      <div className="border-2 border-slate-900 rounded-xl p-6 mb-6">
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

      {/* Modals would go here - importing from separate modal components */}
      {/* For now, keeping modals inline to avoid breaking changes */}
    </div>
  );
};

export default DatabaseSettings;
