import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ChevronLeft, Calendar } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

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
  const { settings } = useSettings();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPeriod, setShowPeriod] = useState('month'); // 'month' or 'historic'
  const [selectedHistoricMonth, setSelectedHistoricMonth] = useState(null);
  const [historicMonths, setHistoricMonths] = useState([]);

  useEffect(() => {
    fetchMetrics();
    fetchHistoricMonths();
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

  const fetchHistoricMonths = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/historic-months`);
      setHistoricMonths(response.data);
    } catch (error) {
      console.error('Error fetching historic months:', error);
    }
  };

  const fetchHistoricData = async (year, month) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/dashboard/historic-data?year=${year}&month=${month}`);
      setSelectedHistoricMonth({ year, month, data: response.data });
    } catch (error) {
      console.error('Error fetching historic data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return <div className="text-center py-4 text-slate-500">Cargando métricas...</div>;
  }

  const currentMetrics = showPeriod === 'month' && metrics
    ? { 
        store_a: metrics.store_a_month, 
        store_b: metrics.store_b_month,
        general: metrics.general_month
      }
    : selectedHistoricMonth?.data
      ? selectedHistoricMonth.data
      : { store_a: {}, store_b: {}, general: {} };

  // Si estamos en vista histórica y hay un mes seleccionado
  if (showPeriod === 'historic' && selectedHistoricMonth) {
    return (
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        data-testid="historic-view"
      >
        {/* Header with back button */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setSelectedHistoricMonth(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-all"
            data-testid="back-to-historic-btn"
          >
            <ChevronLeft className="w-5 h-5" />
            Volver a Histórico
          </button>
          <h3 
            className="text-xl font-bold text-slate-900"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            {MONTH_NAMES[selectedHistoricMonth.month - 1]} {selectedHistoricMonth.year}
          </h3>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tienda A */}
          <div>
            <div 
              className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
              style={{ backgroundColor: '#D4F0A5' }}
            >
              {settings.store_a_name.toUpperCase()}
            </div>
            <div className="space-y-3">
              <MetricCard
                title="Compras"
                value={currentMetrics.store_a.compras || 0}
                icon={Wallet}
                color="#FFF7ED"
              />
              <MetricCard
                title="Ganancia"
                value={currentMetrics.store_a.utilidades || 0}
                icon={TrendingUp}
                color="#D1FAE5"
              />
              <MetricCard
                title="IVA a favor"
                value={currentMetrics.store_a.iva_a_favor || 0}
                icon={DollarSign}
                color="#DBEAFE"
              />
            </div>
          </div>

          {/* Tienda B */}
          <div>
            <div 
              className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
              style={{ backgroundColor: '#FADBB0' }}
            >
              {settings.store_b_name.toUpperCase()}
            </div>
            <div className="space-y-3">
              <MetricCard
                title="Compras"
                value={currentMetrics.store_b.compras || 0}
                icon={Wallet}
                color="#FFF7ED"
              />
              <MetricCard
                title="Ganancia"
                value={currentMetrics.store_b.utilidades || 0}
                icon={TrendingUp}
                color="#D1FAE5"
              />
              <MetricCard
                title="IVA a favor"
                value={currentMetrics.store_b.iva_a_favor || 0}
                icon={DollarSign}
                color="#DBEAFE"
              />
            </div>
          </div>

          {/* General */}
          <div>
            <div 
              className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg bg-white"
            >
              GENERAL
            </div>
            <div className="space-y-3">
              <MetricCard
                title="Otros Ingresos"
                value={currentMetrics.general.otros_ingresos || 0}
                icon={TrendingUp}
                color="#E0E7FF"
              />
              <MetricCard
                title="Egresos"
                value={currentMetrics.general.egresos || 0}
                icon={TrendingDown}
                color="#FEE2E2"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista principal: Total Mes o grid de Histórico
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
            onClick={() => setShowPeriod('month')}
            className={`px-4 py-2 rounded-lg font-bold text-sm border-2 border-slate-900 transition-all ${
              showPeriod === 'month' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
            }`}
            data-testid="period-month-btn"
          >
            Total Mes
          </button>
          <button
            onClick={() => setShowPeriod('historic')}
            className={`px-4 py-2 rounded-lg font-bold text-sm border-2 border-slate-900 transition-all ${
              showPeriod === 'historic' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
            }`}
            data-testid="period-historic-btn"
          >
            Histórico
          </button>
        </div>
      </div>

      {/* Content */}
      {showPeriod === 'month' ? (
        /* Stores Grid - Total Mes */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tienda A */}
          <div>
            <div 
              className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
              style={{ backgroundColor: '#D4F0A5' }}
            >
              {settings.store_a_name.toUpperCase()}
            </div>
            <div className="space-y-3">
              <MetricCard
                title="Compras"
                value={currentMetrics.store_a.compras}
                icon={Wallet}
                color="#FFF7ED"
              />
              <MetricCard
                title="Ganancia"
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
            </div>
          </div>

          {/* Tienda B */}
          <div>
            <div 
              className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
              style={{ backgroundColor: '#FADBB0' }}
            >
              {settings.store_b_name.toUpperCase()}
            </div>
            <div className="space-y-3">
              <MetricCard
                title="Compras"
                value={currentMetrics.store_b.compras}
                icon={Wallet}
                color="#FFF7ED"
              />
              <MetricCard
                title="Ganancia"
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
            </div>
          </div>

          {/* General */}
          <div>
            <div 
              className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg bg-white"
            >
              GENERAL
            </div>
            <div className="space-y-3">
              <MetricCard
                title="Otros Ingresos"
                value={currentMetrics.general.otros_ingresos}
                icon={TrendingUp}
                color="#E0E7FF"
              />
              <MetricCard
                title="Egresos"
                value={currentMetrics.general.egresos}
                icon={TrendingDown}
                color="#FEE2E2"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Historic Grid - Last 2 years */
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Selecciona un mes para ver las métricas históricas
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3">
            {historicMonths.map((item) => (
              <button
                key={`${item.year}-${item.month}`}
                onClick={() => fetchHistoricData(item.year, item.month)}
                className="aspect-square border-2 border-slate-900 rounded-xl hover:bg-slate-100 transition-all flex flex-col items-center justify-center gap-1 p-2"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                data-testid={`historic-month-${item.year}-${item.month}`}
              >
                <Calendar className="w-5 h-5" />
                <span className="font-bold text-xs">{MONTH_NAMES[item.month - 1]}</span>
                <span className="text-[10px] text-slate-600">{item.year}</span>
              </button>
            ))}
          </div>
          {historicMonths.length === 0 && (
            <p className="text-center text-slate-500 py-8">No hay datos históricos disponibles</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RealtimeMetrics;
