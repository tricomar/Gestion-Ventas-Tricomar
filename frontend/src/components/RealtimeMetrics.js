import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ChevronLeft, Calendar, BarChart3, LineChart as LineChartIcon, ChevronRight } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAccount } from '../context/AccountContext';
import { useStores } from '../hooks/useStores';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

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
    <p className="font-mono font-bold text-lg">${(value ?? 0).toLocaleString('es-CL')}</p>
  </div>
);

const RealtimeMetrics = ({ refreshTrigger }) => {
  const { settings } = useSettings();
  const { account } = useAccount();
  const { stores } = useStores();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPeriod, setShowPeriod] = useState('month'); // 'month' or 'historic'
  const [selectedHistoricMonth, setSelectedHistoricMonth] = useState(null);
  const [historicMonths, setHistoricMonths] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [chartType, setChartType] = useState('both'); // 'bars', 'lines', 'both'
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState(null);
  const [currentStoresPage, setCurrentStoresPage] = useState(0); // Para paginación de tiendas

  useEffect(() => {
    fetchMetrics();
    fetchHistoricMonths();
  }, [refreshTrigger]);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API}/dashboard/realtime-metrics`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching realtime metrics:', error);
      setError('Error al cargar métricas en tiempo real');
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
      setLoadingChart(true);
      setError(null);
      
      // Fetch monthly metrics
      const response = await axios.get(`${API}/dashboard/historic-data?year=${year}&month=${month}`);
      setSelectedHistoricMonth({ year, month, data: response.data });
      
      // Fetch daily data for chart
      const dailyResponse = await axios.get(`${API}/dashboard/historic-daily-data?year=${year}&month=${month}`);
      setDailyData(dailyResponse.data);
      
      setLoadingChart(false);
    } catch (error) {
      console.error('Error fetching historic data:', error);
      setError(`Error al cargar datos de ${MONTH_NAMES[month-1]} ${year}`);
      setLoadingChart(false);
      setSelectedHistoricMonth(null); // Reset selection on error
    }
  };

  const handleBackToMonth = () => {
    setShowPeriod('month');
    setSelectedHistoricMonth(null);
    setError(null);
  };

  // Helper: Renderizar columna de tienda
  const renderStoreColumn = (store, storeData, index) => {
    const colors = ['#D4F0A5', '#FADBB0', '#FFE4E6', '#E0E7FF', '#FEF3C7'];
    const color = colors[index % colors.length];
    
    return (
      <div key={store.id}>
        <div 
          className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg"
          style={{ backgroundColor: color }}
        >
          {store.name.toUpperCase()}
        </div>
        <div className="space-y-3">
          <MetricCard
            title="Compras"
            value={storeData?.compras || 0}
            icon={Wallet}
            color="#FFF7ED"
          />
          <MetricCard
            title="Ganancia"
            value={storeData?.utilidades || 0}
            icon={TrendingUp}
            color="#D1FAE5"
          />
          <MetricCard
            title="IVA a favor"
            value={storeData?.iva_a_favor || 0}
            icon={DollarSign}
            color="#DBEAFE"
          />
        </div>
      </div>
    );
  };

  // Helper: Renderizar columna general
  const renderGeneralColumn = (generalData) => {
    return (
      <div>
        <div 
          className="mb-3 px-4 py-2 border-2 border-slate-900 rounded-lg text-center font-black text-lg bg-white"
        >
          GENERAL
        </div>
        <div className="space-y-3">
          <MetricCard
            title="Otros Ingresos"
            value={generalData?.otros_ingresos || 0}
            icon={TrendingUp}
            color="#E0E7FF"
          />
          <MetricCard
            title="Egresos"
            value={generalData?.egresos || 0}
            icon={TrendingDown}
            color="#FEE2E2"
          />
        </div>
      </div>
    );
  };

  if (loading && !metrics && !selectedHistoricMonth) {
    return <div className="text-center py-4 text-slate-500">Cargando métricas...</div>;
  }

  if (error && !metrics && !selectedHistoricMonth) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-lg hover:bg-slate-50 transition-all font-bold text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Determinar qué métricas mostrar según el periodo seleccionado
  const getCurrentStores = () => {
    if (showPeriod === 'month' && metrics) {
      return metrics.stores_month;
    } else if (selectedHistoricMonth?.data) {
      return selectedHistoricMonth.data.stores;
    }
    return {};
  };

  const getCurrentGeneral = () => {
    if (showPeriod === 'month' && metrics) {
      return metrics.general_month;
    } else if (selectedHistoricMonth?.data) {
      return selectedHistoricMonth.data.general;
    }
    return { otros_ingresos: 0, egresos: 0 };
  };

  const getCurrentStoreInfo = () => {
    if (showPeriod === 'month' && metrics) {
      return metrics.store_info || [];
    } else if (selectedHistoricMonth?.data) {
      return selectedHistoricMonth.data.store_info || [];
    }
    return [];
  };

  const currentStores = getCurrentStores();
  const currentGeneral = getCurrentGeneral();
  const currentStoreInfo = getCurrentStoreInfo();

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

        {/* Metrics Grid - Dinámico según tiendas disponibles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Renderizar tiendas dinámicamente */}
          {currentStoreInfo.map((storeInfo, index) => {
            const storeData = currentStores[storeInfo.id] || {};
            return renderStoreColumn(
              { id: storeInfo.id, name: storeInfo.name },
              storeData,
              index
            );
          })}

          {/* Columna General */}
          {renderGeneralColumn(currentGeneral)}
        </div>

        {/* Chart Section */}
        <div className="mt-8">
          {/* Chart Controls */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-slate-900">
              Gráfico de Ventas por Día
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('bars')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border-2 border-slate-900 transition-all ${
                  chartType === 'bars' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                }`}
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                <BarChart3 className="w-4 h-4" />
                Barras
              </button>
              <button
                onClick={() => setChartType('lines')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border-2 border-slate-900 transition-all ${
                  chartType === 'lines' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                }`}
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                <LineChartIcon className="w-4 h-4" />
                Líneas
              </button>
              <button
                onClick={() => setChartType('both')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border-2 border-slate-900 transition-all ${
                  chartType === 'both' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                }`}
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                <BarChart3 className="w-4 h-4" />
                <LineChartIcon className="w-4 h-4" />
                Combinado
              </button>
            </div>
          </div>

          {/* Chart */}
          {loadingChart ? (
            <div className="text-center py-12 text-slate-500">Cargando gráfico...</div>
          ) : dailyData.length > 0 ? (
            <div className="border-2 border-slate-900 rounded-xl p-4 bg-slate-50">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="day" 
                    label={{ value: 'Día del Mes', position: 'insideBottom', offset: -5 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Monto ($)', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value) => `$${value.toLocaleString('es-CL')}`}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '2px solid #0f172a',
                      borderRadius: '8px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  
                  {/* Generar dinámicamente barras y líneas para cada tienda */}
                  {currentStoreInfo.map((storeInfo, index) => {
                    const barColors = ['#D4F0A5', '#FADBB0', '#FFE4E6', '#E0E7FF', '#FEF3C7'];
                    const lineColors = {
                      compras: ['#84cc16', '#f97316', '#ec4899', '#8b5cf6', '#eab308'],
                      utilidades: ['#10b981', '#3b82f6', '#f43f5e', '#6366f1', '#f59e0b']
                    };
                    
                    const barFill = barColors[index % barColors.length];
                    const comprasStroke = lineColors.compras[index % lineColors.compras.length];
                    const utilidadesStroke = lineColors.utilidades[index % lineColors.utilidades.length];
                    
                    return (
                      <React.Fragment key={storeInfo.id}>
                        {/* Compras */}
                        {(chartType === 'bars' || chartType === 'both') && (
                          <Bar 
                            dataKey={`${storeInfo.id}.compras`}
                            name={`${storeInfo.name} - Compras`}
                            fill={barFill}
                            stroke="#0f172a"
                            strokeWidth={2}
                          />
                        )}
                        {(chartType === 'lines' || chartType === 'both') && (
                          <Line 
                            type="monotone" 
                            dataKey={`${storeInfo.id}.compras`}
                            name={chartType === 'lines' ? `${storeInfo.name} - Compras` : undefined}
                            stroke={comprasStroke}
                            strokeWidth={3}
                            dot={{ fill: comprasStroke, r: 4 }}
                          />
                        )}

                        {/* Utilidades */}
                        {(chartType === 'bars' || chartType === 'both') && (
                          <Bar 
                            dataKey={`${storeInfo.id}.utilidades`}
                            name={`${storeInfo.name} - Ganancia`}
                            fill={barFill}
                            stroke="#0f172a"
                            strokeWidth={2}
                            opacity={0.7}
                          />
                        )}
                        {(chartType === 'lines' || chartType === 'both') && (
                          <Line 
                            type="monotone" 
                            dataKey={`${storeInfo.id}.utilidades`}
                            name={chartType === 'lines' ? `${storeInfo.name} - Ganancia` : undefined}
                            stroke={utilidadesStroke}
                            strokeWidth={3}
                            dot={{ fill: utilidadesStroke, r: 4 }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              No hay datos disponibles para este mes
            </div>
          )}
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
        /* Stores Grid - Total Mes - Dinámico */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Renderizar tiendas dinámicamente */}
          {currentStoreInfo.map((storeInfo, index) => {
            const storeData = currentStores[storeInfo.id] || {};
            return renderStoreColumn(
              { id: storeInfo.id, name: storeInfo.name },
              storeData,
              index
            );
          })}

          {/* Columna General */}
          {renderGeneralColumn(currentGeneral)}
        </div>
      ) : (
        /* Historic Grid - Last 2 years */
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Selecciona un mes para ver las métricas históricas
          </p>
          
          {/* Loading Indicator */}
          {loadingChart && (
            <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-500 rounded-xl flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-blue-900 font-medium">Cargando datos históricos...</span>
            </div>
          )}
          
          {/* Error Indicator */}
          {error && !loadingChart && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-xl">
              <p className="text-red-900 font-bold mb-2">{error}</p>
              <button
                onClick={fetchHistoricMonths}
                className="px-4 py-2 bg-white border-2 border-slate-900 rounded-lg hover:bg-slate-50 transition-all font-bold text-sm"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                Reintentar
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3">
            {historicMonths.map((item) => (
              <button
                key={`${item.year}-${item.month}`}
                onClick={() => fetchHistoricData(item.year, item.month)}
                disabled={loadingChart}
                className="aspect-square border-2 border-slate-900 rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center gap-1 p-2"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                data-testid={`historic-month-${item.year}-${item.month}`}
              >
                <Calendar className="w-5 h-5" />
                <span className="font-bold text-xs">{MONTH_NAMES[item.month - 1]}</span>
                <span className="text-[10px] text-slate-600">{item.year}</span>
              </button>
            ))}
          </div>
          {historicMonths.length === 0 && !loadingChart && (
            <p className="text-center text-slate-500 py-8">No hay datos históricos disponibles</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RealtimeMetrics;
