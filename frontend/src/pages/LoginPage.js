import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isRegister) {
      const result = await register(email, password, name);
      if (result.success) {
        toast.success('Registro exitoso');
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Sesión iniciada');
      } else {
        toast.error(result.error);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F4F4F0' }}>
      {/* Left Side - Branding */}
      <div 
        className="hidden md:flex md:w-1/2 bg-white relative items-center justify-center p-12"
      >
        <div className="text-center w-full max-w-xl">
          <img 
            src="/negocio-feliz-logo.png" 
            alt="Negocio Feliz" 
            className="w-full mx-auto mb-12"
          />
          <h2 className="text-4xl font-black text-slate-900 leading-tight">
            La Tecnología que Ordena tu Venta<br />y Aumenta tus Ganancias
          </h2>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div 
          className="w-full max-w-md bg-white border-2 border-slate-900 rounded-xl p-8"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          data-testid="login-form-container"
        >
          <h1 
            className="text-4xl font-black tracking-tighter text-slate-900 mb-2"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h1>
          <p className="text-base font-medium text-slate-600 mb-8">
            Sistema de Gestión de Ventas
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => e.target.style.boxShadow = '4px 4px 0px 0px rgba(99,102,241,1)'}
                  onBlur={(e) => e.target.style.boxShadow = 'none'}
                  required
                  data-testid="register-name-input"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                {isRegister ? 'Email' : 'Usuario / Email'}
              </label>
              <input
                type={isRegister ? "email" : "text"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                style={{ boxShadow: 'none' }}
                onFocus={(e) => e.target.style.boxShadow = '4px 4px 0px 0px rgba(99,102,241,1)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                placeholder={isRegister ? "" : "usuario o email"}
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                style={{ boxShadow: 'none' }}
                onFocus={(e) => e.target.style.boxShadow = '4px 4px 0px 0px rgba(99,102,241,1)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                required
                data-testid="login-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-slate-900 border-2 border-slate-900 hover:bg-opacity-90 rounded-xl px-6 py-3 font-bold transition-all"
              style={{
                backgroundColor: '#D4F0A5',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
              }}
              data-testid="login-submit-btn"
            >
              {loading ? 'Procesando...' : (isRegister ? 'Registrarse' : 'Ingresar')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-indigo-600 font-bold hover:underline"
              data-testid="toggle-auth-mode-btn"
            >
              {isRegister 
                ? '¿Ya tienes cuenta? Inicia sesión' 
                : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
