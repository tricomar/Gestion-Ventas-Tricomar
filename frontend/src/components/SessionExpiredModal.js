import React, { useState } from 'react';
import { AlertTriangle, LogIn } from 'lucide-react';

const SessionExpiredModal = ({ isOpen, onReauthenticate, onLogout }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await onReauthenticate(email, password);
    
    if (!result.success) {
      setError(result.error || 'Credenciales incorrectas');
      setLoading(false);
    }
    // Si es exitoso, el modal se cerrará automáticamente
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div 
        className="bg-white border-4 border-slate-900 rounded-2xl p-8 max-w-md w-full mx-4"
        style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-amber-100 border-2 border-slate-900 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Sesión Expirada</h2>
          <p className="text-slate-600">
            Tu sesión ha caducado por inactividad. Por favor, inicia sesión nuevamente para continuar.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border-2 border-red-900 rounded-lg p-3">
              <p className="text-sm text-red-900 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="tu@email.com"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 px-6 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              disabled={loading}
            >
              Cerrar Sesión
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              disabled={loading}
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Conectando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-500 text-center mt-4">
          No perderás tu trabajo. Después de iniciar sesión, podrás continuar donde lo dejaste.
        </p>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
