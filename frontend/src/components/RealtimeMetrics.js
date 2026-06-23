import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MetricCard = ({ title, value, icon: Icon, color }) => (
  <div 
    className="border-2 border-slate-900 rounded-xl p-3"
    style={{ backgroundColor: color }}
  >
    <div className="flex items-center justify-between mb-1">
      <Icon className="w-4 h-4" />
      <span className="text-xs font-bold uppercase">{title}</span>
    </div>
    <p className="font-mono font-bold text-lg">${value.toLocaleString('es-CL')}</p>
  </div>
);

const RealtimeMetrics = ({ refreshTrigger }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPeriod, setShowPeriod] = useState('day'); // day or month

  useEffect(() => {
    fetchMetrics();
  }, [refreshTrigger]);

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/realtime-metrics`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching realtime metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return <div className="text-center py-4 text-slate-500">Cargando métricas...</div>;
  }

  const currentMetrics = showPeriod === 'day' 
    ? { store_a: metrics.store_a_day, store_b: metrics.store_b_day }
    : { store_a: metrics.store_a_month, store_b: metrics.store_b_month };

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-6"
      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      data-testid="realtime-metrics"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
        >
          Métricas en Tiempo Real
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPeriod('day')}
            className={`px-4 py-2 rounded-lg font-bold text-sm border-2 border-slate-900 transition-all ${
              showPeriod === 'day' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
            }`}
            data-testid="period-day-btn"
          >
            Hoy
          </button>
          <button
            onClick={() => setShowPeriod('month')}
            className={`px-4 py-2 rounded-lg font-bold text-sm border-2 border-slate-900 transition-all ${
              showPeriod === 'month' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
            }`}
            data-testid="period-month-btn"
          >
            Este Mes
          </button>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tienda A */}
        <div>
          <div 
            className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
            style={{ backgroundColor: '#D4F0A5' }}
          >
            TIENDA A
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="Compras"
              value={currentMetrics.store_a.compras}
              icon={Wallet}
              color="#FFF7ED"
            />
            <MetricCard
              title="Utilidades"
              value={currentMetrics.store_a.utilidades}
              icon={TrendingUp}
              color="#D1FAE5"
            />
            <MetricCard
              title="IVA a favor"
              value={currentMetrics.store_a.iva_a_favor}
              icon={DollarSign}
              color="#DBEAFE"
            />
            <MetricCard
              title="Otros Ingresos"
              value={currentMetrics.store_a.otros_ingresos}
              icon={TrendingUp}
              color="#E0E7FF"
            />
            <MetricCard
              title="Egresos"
              value={currentMetrics.store_a.egresos}
              icon={TrendingDown}
              color="#FEE2E2"
            />
          </div>
        </div>

        {/* Tienda B */}
        <div>
          <div 
            className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
            style={{ backgroundColor: '#FADBB0' }}
          >
            TIENDA B
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="Compras"
              value={currentMetrics.store_b.compras}
              icon={Wallet}
              color="#FFF7ED"
            />
            <MetricCard
              title="Utilidades"
              value={currentMetrics.store_b.utilidades}
              icon={TrendingUp}
              color="#D1FAE5"
            />
            <MetricCard
              title="IVA a favor"
              value={currentMetrics.store_b.iva_a_favor}
              icon={DollarSign}
              color="#DBEAFE"
            />
            <MetricCard
              title="Otros Ingresos"
              value={currentMetrics.store_b.otros_ingresos}
              icon={TrendingUp}
              color="#E0E7FF"
            />
            <MetricCard
              title="Egresos"
              value={currentMetrics.store_b.egresos}
              icon={TrendingDown}
              color="#FEE2E2"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeMetrics;
