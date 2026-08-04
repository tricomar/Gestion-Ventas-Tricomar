import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Home, ShoppingCart, Package, Users, BarChart3, TrendingUp, Settings, LogOut, User } from 'lucide-react';

const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSettings();

  const menuItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', color: 'from-purple-400 to-pink-400' },
    { path: '/pos', icon: ShoppingCart, label: 'Punto de Venta', color: 'from-orange-400 to-red-400' },
    { path: '/inventory', icon: Package, label: 'Inventario', color: 'from-yellow-400 to-orange-400' },
    { path: '/customers', icon: Users, label: 'Clientes', color: 'from-pink-400 to-purple-400' },
    { path: '/reports', icon: BarChart3, label: 'Reportes', color: 'from-blue-400 to-purple-400' },
    { path: '/analytics', icon: TrendingUp, label: 'Analítica', color: 'from-purple-500 to-pink-500' },
    { path: '/settings', icon: Settings, label: 'Configuración', color: 'from-slate-400 to-slate-600' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout('manual');
    navigate('/login');
  };

  return (
    <div 
      className="w-full border-b-4 border-slate-900 bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100"
      style={{ boxShadow: '0 4px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="max-w-full px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            {settings?.company_logo ? (
              <img 
                src={settings.company_logo} 
                alt="Logo" 
                className="h-12 w-auto border-2 border-slate-900 rounded-lg"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              />
            ) : (
              <div 
                className="h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-slate-900 rounded-lg flex items-center justify-center"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                <span className="text-white font-black text-xl">ERP</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-black text-slate-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                {settings?.company_name || 'Negocio Feliz'}
              </h1>
              <p className="text-xs text-slate-600 font-medium">Sistema de Gestión</p>
            </div>
          </div>

          {/* Navigation Icons */}
          <div className="flex items-center gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`group flex flex-col items-center gap-1 px-4 py-2 rounded-xl border-2 border-slate-900 font-bold transition-all ${
                    active 
                      ? 'bg-slate-900 text-white scale-105' 
                      : 'bg-white text-slate-900 hover:scale-105'
                  }`}
                  style={{ 
                    boxShadow: active ? '3px 3px 0px 0px rgba(15,23,42,1)' : '2px 2px 0px 0px rgba(15,23,42,1)',
                    minWidth: '90px'
                  }}
                  data-testid={`topbar-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <div className={`p-1.5 rounded-lg bg-gradient-to-br ${item.color} ${active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-xl"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900">{user?.name || 'Usuario'}</p>
                <p className="text-xs text-slate-600">{user?.email}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:bg-red-600 transition-all"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              data-testid="topbar-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
