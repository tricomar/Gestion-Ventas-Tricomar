import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, Settings, Database, Store, LogOut, ShieldCheck } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const adminOptions = [
    {
      id: 'accounts',
      title: 'Gestión de Cuentas',
      description: 'Administrar cuentas de clientes, planes y límites',
      icon: Users,
      color: '#D4F0A5',
      route: '/super-admin'
    },
    {
      id: 'settings',
      title: 'Configuración',
      description: 'Configuraciones generales del sistema',
      icon: Settings,
      color: '#FADBB0',
      route: '/settings'
    },
    {
      id: 'database',
      title: 'Base de Datos',
      description: 'Gestión y mantenimiento de la base de datos',
      icon: Database,
      color: '#FFE4E6',
      route: '/settings?tab=database'
    },
    {
      id: 'stores',
      title: 'Tiendas',
      description: 'Configuración de tiendas del sistema',
      icon: Store,
      color: '#E0E7FF',
      route: '/settings?tab=stores'
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b-4 border-slate-900 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-8 h-8 text-purple-600" />
              <h1 
                className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900"
                style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
              >
                Panel de Administración
              </h1>
            </div>
            <p className="text-slate-600">
              Bienvenido, <span className="font-bold">{user?.name || 'Super Admin'}</span>
            </p>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white border-2 border-slate-900 rounded-xl hover:bg-red-600 transition-all font-bold"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Welcome Card */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6 mb-8"
          style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
        >
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            🎯 Panel de Control del Sistema
          </h2>
          <p className="text-slate-600">
            Desde aquí puedes administrar todas las configuraciones del sistema, gestionar cuentas de clientes, 
            y realizar operaciones de mantenimiento de la base de datos.
          </p>
        </div>

        {/* Admin Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => navigate(option.route)}
                className="bg-white border-4 border-slate-900 rounded-2xl p-8 text-left hover:scale-105 transition-all group"
                style={{ 
                  boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)',
                }}
                data-testid={`admin-option-${option.id}`}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="p-4 border-2 border-slate-900 rounded-xl"
                    style={{ backgroundColor: option.color }}
                  >
                    <Icon className="w-8 h-8 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                      {option.title}
                    </h3>
                    <p className="text-slate-600">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>
            Sistema de Gestión Multi-Tenant • Super Admin Panel • 
            <span className="font-bold text-slate-700"> v2.0</span>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
