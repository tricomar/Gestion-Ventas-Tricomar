import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Database, AlertTriangle, CheckCircle, Trash2, RotateCcw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DatabaseManagementPage = () => {
  const navigate = useNavigate();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSoftResetModal, setShowSoftResetModal] = useState(false);
  const [resetType, setResetType] = useState(''); // 'hard' o 'soft'
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [softResetOptions, setSoftResetOptions] = useState({
    sales: false,
    expenses: false,
    income: false,
    customers: false
  });
  const [loading, setLoading] = useState(false);

  const handleHardReset = async () => {
    if (confirmationText !== 'RESETEAR') {
      toast.error('Debes escribir "RESETEAR" para confirmar');
      return;
    }

    if (!password || !newPassword) {
      toast.error('Completa todos los campos');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/database/hard-reset`,
        {
          password,
          new_password: newPassword,
          account_id: 'all' // Super-admin puede resetear todo
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      toast.success('Base de datos reseteada exitosamente');
      setShowResetModal(false);
      setPassword('');
      setNewPassword('');
      setConfirmationText('');
    } catch (error) {
      console.error('Error en hard reset:', error);
      toast.error(error.response?.data?.detail || 'Error al resetear la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSoftReset = async () => {
    if (confirmationText !== 'RESETEAR') {
      toast.error('Debes escribir "RESETEAR" para confirmar');
      return;
    }

    if (!password) {
      toast.error('Ingresa tu contraseña');
      return;
    }

    const selectedOptions = Object.entries(softResetOptions)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    if (selectedOptions.length === 0) {
      toast.error('Selecciona al menos una opción');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/database/soft-reset`,
        {
          password,
          options: softResetOptions,
          account_id: 'all'
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      toast.success('Datos eliminados exitosamente');
      setShowSoftResetModal(false);
      setPassword('');
      setConfirmationText('');
      setSoftResetOptions({
        sales: false,
        expenses: false,
        income: false,
        customers: false
      });
    } catch (error) {
      console.error('Error en soft reset:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
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
            <Database className="w-8 h-8 text-slate-900" />
            <h1 className="text-4xl font-black text-slate-900">Gestión de Base de Datos</h1>
          </div>
          <p className="text-slate-600">Operaciones de mantenimiento y reinicio de la base de datos</p>
        </div>

        {/* Warning Card */}
        <div 
          className="bg-yellow-50 border-2 border-yellow-500 rounded-xl p-6 mb-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(234,179,8,1)' }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-yellow-900 mb-2">⚠️ Advertencia Importante</h3>
              <p className="text-yellow-800 text-sm">
                Las operaciones de esta sección son <strong>irreversibles</strong> y afectan a <strong>TODAS las cuentas</strong> del sistema. 
                Usa estas funciones con extrema precaución.
              </p>
            </div>
          </div>
        </div>

        {/* Reset Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hard Reset */}
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 border-2 border-slate-900 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Hard Reset</h3>
                <p className="text-sm text-slate-600">Reinicio completo</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-4 text-sm">
              Elimina <strong>TODOS los datos</strong> y crea un nuevo administrador. 
              Todas las cuentas, usuarios, ventas, gastos e inventarios serán eliminados.
            </p>

            <button
              onClick={() => setShowResetModal(true)}
              className="w-full px-4 py-3 bg-red-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-red-600 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              Ejecutar Hard Reset
            </button>
          </div>

          {/* Soft Reset */}
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 border-2 border-slate-900 rounded-xl">
                <RotateCcw className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Soft Reset</h3>
                <p className="text-sm text-slate-600">Limpieza selectiva</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-4 text-sm">
              Elimina solo los datos seleccionados (ventas, gastos, etc.) 
              manteniendo usuarios, productos e inventario intactos.
            </p>

            <button
              onClick={() => setShowSoftResetModal(true)}
              className="w-full px-4 py-3 bg-orange-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-orange-600 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              Ejecutar Soft Reset
            </button>
          </div>
        </div>

        {/* Hard Reset Modal */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white border-4 border-slate-900 rounded-2xl p-8 max-w-lg w-full"
              style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
            >
              <h2 className="text-2xl font-black mb-4">⚠️ Confirmar Hard Reset</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-bold mb-2">Contraseña Actual *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="Tu contraseña"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-2">Nueva Contraseña Admin *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="Nueva contraseña"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-2">
                    Escribe "RESETEAR" para confirmar *
                  </label>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="RESETEAR"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-300"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleHardReset}
                  className="flex-1 px-4 py-3 bg-red-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-red-600"
                  disabled={loading}
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  {loading ? 'Procesando...' : 'Confirmar Reset'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Soft Reset Modal */}
        {showSoftResetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white border-4 border-slate-900 rounded-2xl p-8 max-w-lg w-full"
              style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
            >
              <h2 className="text-2xl font-black mb-4">Soft Reset - Seleccionar Datos</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-bold mb-3">¿Qué datos deseas eliminar?</label>
                  <div className="space-y-2">
                    {Object.entries({
                      sales: 'Ventas',
                      expenses: 'Gastos',
                      income: 'Otros Ingresos',
                      customers: 'Clientes'
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 p-3 border-2 border-slate-900 rounded-xl cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={softResetOptions[key]}
                          onChange={(e) => setSoftResetOptions({
                            ...softResetOptions,
                            [key]: e.target.checked
                          })}
                          className="w-5 h-5"
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-2">Contraseña *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="Tu contraseña"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-2">
                    Escribe "RESETEAR" para confirmar *
                  </label>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl"
                    placeholder="RESETEAR"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSoftResetModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-200 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-300"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSoftReset}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-orange-600"
                  disabled={loading}
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                >
                  {loading ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseManagementPage;
