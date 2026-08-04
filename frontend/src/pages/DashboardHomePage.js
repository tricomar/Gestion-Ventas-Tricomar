import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Package, Store, AlertCircle } from 'lucide-react';
import { useStores } from '../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardHomePage = () => {
  const { stores } = useStores();
  const [metrics, setMetrics] = useState({
    yearly_sales: 0,
    monthly_sales: 0,
    daily_sales: 0,
    total_products: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch métricas principales
      const metricsRes = await axios.get(`${API}/dashboard/stats`);
      const stats = metricsRes.data;
      
      setMetrics({
        yearly_sales: stats.yearly_total || 0,
        monthly_sales: stats.monthly_total || 0,
        daily_sales: stats.today_total || 0,
        total_products: stats.total_products || 0
      });

      // Fetch últimas ventas
      const salesRes = await axios.get(`${API}/sales?limit=10`);
      setRecentSales(salesRes.data.slice(0, 5));

      // Fetch datos para gráfico (últimos 30 días por tienda)
      const graphRes = await axios.get(`${API}/dashboard/sales-by-store?days=30`);
      setChartData(graphRes.data || []);

      // Fetch integraciones activas
      const integrationsRes = await axios.get(`${API}/integrations/prestashop/list`);
      setIntegrations(integrationsRes.data || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ title, value, icon: Icon, gradient, trend }) => (
    <div 
      className={`bg-gradient-to-br ${gradient} border-2 border-slate-900 rounded-xl p-6`}
      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white/90 border-2 border-slate-900 rounded-lg">
          <Icon className="w-6 h-6 text-slate-900" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 px-2 py-1 bg-white/90 border border-slate-900 rounded-lg">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <span className="text-xs font-bold text-green-600">{trend}</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-3xl font-black text-slate-900">${value.toLocaleString('es-CL')}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 
          className="text-5xl font-black text-slate-900 mb-2"
          style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
        >
          ¡Bienvenido! 👋
        </h1>
        <p className="text-lg text-slate-600 font-medium">
          Resumen de tu negocio en tiempo real
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="Ventas Anuales"
          value={metrics.yearly_sales}
          icon={TrendingUp}
          gradient="from-purple-400 to-pink-400"
        />
        <MetricCard 
          title="Ventas Mensuales"
          value={metrics.monthly_sales}
          icon={DollarSign}
          gradient="from-orange-400 to-red-400"
        />
        <MetricCard 
          title="Ventas Hoy"
          value={metrics.daily_sales}
          icon={ShoppingBag}
          gradient="from-yellow-400 to-orange-400"
        />
        <MetricCard 
          title="Total Productos"
          value={metrics.total_products}
          icon={Package}
          gradient="from-pink-400 to-purple-400"
        />
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Chart */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Ventas por Tienda (Últimos 30 días)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="date" stroke="#475569" style={{ fontSize: '12px' }} />
              <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '2px solid #0f172a',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              {stores.map((store, index) => {
                const colors = ['#8b5cf6', '#ec4899', '#f97316', '#eab308'];
                return (
                  <Line 
                    key={store.code}
                    type="monotone" 
                    dataKey={store.code} 
                    name={store.name}
                    stroke={colors[index % colors.length]} 
                    strokeWidth={3}
                    dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Sales */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Últimas Ventas
          </h2>
          <div className="space-y-3">
            {recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div 
                  key={sale.id}
                  className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-slate-900 rounded-lg"
                >
                  <div>
                    <p className="font-bold text-slate-900">${sale.total.toLocaleString('es-CL')}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(sale.created_at).toLocaleString('es-CL', { 
                        dateStyle: 'short', 
                        timeStyle: 'short' 
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 bg-white border border-slate-900 rounded text-xs font-bold">
                      {sale.payment_method}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-8">No hay ventas recientes</p>
            )}
          </div>
        </div>
      </div>

      {/* Ecommerce Integrations */}
      <div 
        className="bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      >
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Store className="w-5 h-5" />
          Integraciones Ecommerce
        </h2>
        {integrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <div 
                key={integration.id}
                className="bg-white border-2 border-slate-900 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-slate-900">{integration.store_name}</p>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    integration.is_active 
                      ? 'bg-green-100 text-green-800 border border-green-800' 
                      : 'bg-red-100 text-red-800 border border-red-800'
                  }`}>
                    {integration.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Última sincronización: {integration.last_sync_products 
                    ? new Date(integration.last_sync_products).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
                    : 'Nunca'
                  }
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-2">No hay integraciones activas</p>
            <p className="text-sm text-slate-500">Conecta tus tiendas online desde Configuración → Integraciones</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHomePage;
