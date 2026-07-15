import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EconomicIndicators = () => {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState(new Date());

  useEffect(() => {
    fetchIndicators();
    // Refresh every 5 minutes
    const interval = setInterval(fetchIndicators, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Update server time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchIndicators = async () => {
    try {
      const response = await axios.get(`${API}/indicators`);
      setIndicators(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching indicators:', error);
      setLoading(false);
    }
  };

  const formatValue = (value, name) => {
    if (!value) return '-';
    
    // Bitcoin y Libra Cobre son valores grandes
    if (name === 'Bitcoin' || name === 'Libra Cobre') {
      return value.toLocaleString('es-CL', { maximumFractionDigits: 0 });
    }
    
    // Otros con 2 decimales
    return value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getIndicatorColor = (name) => {
    const colors = {
      'UF': '#D4F0A5',
      'Dólar': '#FADBB0',
      'Bitcoin': '#FFE5B4',
      'Euro': '#E0E7FF',
      'UTM': '#D1FAE5',
      'Libra Cobre': '#FECACA'
    };
    return colors[name] || '#F3F4F6';
  };

  const formatTime = () => {
    // Formatear hora en zona horaria de Chile
    const options = {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return serverTime.toLocaleTimeString('es-CL', options);
  };

  const formatDate = () => {
    // Formatear fecha en zona horaria de Chile
    const options = {
      timeZone: 'America/Santiago',
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    };
    return serverTime.toLocaleDateString('es-CL', options);
  };

  if (loading) {
    return (
      <div className="flex gap-2 items-center">
        <div className="text-sm text-slate-600">Cargando indicadores...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 items-center justify-between w-full">
      {/* Indicadores Económicos */}
      <div className="flex flex-wrap gap-3 items-center">
        {!indicators || indicators.length === 0 ? (
          <div className="text-xs text-slate-500">Indicadores no disponibles</div>
        ) : (
          indicators.map((indicator, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 border-2 border-slate-900 rounded-lg"
              style={{ 
                backgroundColor: getIndicatorColor(indicator.name),
                boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)'
              }}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  {indicator.name}
              </span>
              <span className="text-sm font-black text-slate-900">
                ${formatValue(indicator.value, indicator.name)}
              </span>
            </div>
          </div>
          ))
        )}
      </div>

      {/* Reloj del Servidor */}
      <div 
        className="flex items-center gap-3 px-4 py-2 border-2 border-slate-900 rounded-lg bg-white"
        style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
      >
        <Clock className="w-5 h-5 text-slate-700" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-600 uppercase">
            Hora Servidor (Chile)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {formatTime()}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {formatDate()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EconomicIndicators;
