import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Store, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import KPICards from '../components/analytics/KPICards';
import TemporalCharts from '../components/analytics/TemporalCharts';
import ProductsCharts from '../components/analytics/ProductsCharts';
import StoresPaymentsCharts from '../components/analytics/StoresPaymentsCharts';
import CustomersCharts from '../components/analytics/CustomersCharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AnalyticsPage = () => {
  const [period, setPeriod] = useState('month');
  const [storeFilter, setStoreFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Datos
  const [summary, setSummary] = useState(null);
  const [temporal, setTemporal] = useState(null);
  const [products, setProducts] = useState(null);
  const [storesPayments, setStoresPayments] = useState(null);
  const [customers, setCustomers] = useState(null);
  
  // Tiendas disponibles
  const [stores, setStores] = useState([]);

  useEffect(() => {
    fetchStores();
    fetchAllData();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(() => {
      fetchAllData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [period, storeFilter]);

  const fetchStores = async () => {
    try {
      const response = await axios.get(`${API}/auth/account/info`);
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const params = {
        period,
        ...(storeFilter !== 'all' && { store_id: storeFilter })
      };

      const [summaryRes, temporalRes, productsRes, storesPaymentsRes, customersRes] = await Promise.all([
        axios.get(`${API}/analytics/summary`, { params }),
        axios.get(`${API}/analytics/temporal`, { params }),
        axios.get(`${API}/analytics/products`, { params }),
        axios.get(`${API}/analytics/stores-payments`, { params }),
        axios.get(`${API}/analytics/customers`, { params })
      ]);

      setSummary(summaryRes.data);
      setTemporal(temporalRes.data);
      setProducts(productsRes.data);
      setStoresPayments(storesPaymentsRes.data);
      setCustomers(customersRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodOptions = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: 'year', label: 'Este Año' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl">
              <BarChart3 className="w-8 h-8 text-slate-900" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900">Analítica</h1>
              <p className="text-sm text-slate-600">
                Última actualización: {format(lastUpdate, "HH:mm:ss", { locale: es })}
              </p>
            </div>
          </div>
          
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50"
            style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4">
          {/* Selector de periodo */}
          <div className="flex items-center gap-2 bg-white border-2 border-slate-900 rounded-xl p-1">
            <Calendar className="w-5 h-5 ml-2 text-slate-600" />
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  period === option.value
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Selector de tienda */}
          {stores.length > 1 && (
            <div className="flex items-center gap-2 bg-white border-2 border-slate-900 rounded-xl px-3 py-2">
              <Store className="w-5 h-5 text-slate-600" />
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
              >
                <option value="all">Todas las Tiendas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.code}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 animate-spin text-slate-900 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-600">Cargando analítica...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPIs */}
          {summary && <KPICards data={summary.kpis} />}

          {/* Gráficos Temporales */}
          {temporal && <TemporalCharts data={temporal} />}

          {/* Productos */}
          {products && <ProductsCharts data={products} />}

          {/* Tiendas y Pagos */}
          {storesPayments && <StoresPaymentsCharts data={storesPayments} stores={stores} />}

          {/* Clientes */}
          {customers && <CustomersCharts data={customers} />}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
