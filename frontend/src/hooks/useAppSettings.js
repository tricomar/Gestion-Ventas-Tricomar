import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Context para configuración global de la app
const AppSettingsContext = createContext();

export const AppSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    timezone: 'America/Santiago',
    currency_code: 'CLP',
    currency_symbol: '$',
    decimal_places: 0,
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    loading: true
  });

  const [timezones, setTimezones] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    // At this point, user is already authenticated (provider only mounts in ProtectedRoute)
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    fetchSettings();
    fetchTimezones();
    fetchCurrencies();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/app-settings`);
      setSettings({
        ...response.data,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching app settings:', error);
      setSettings(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchTimezones = async () => {
    try {
      const response = await axios.get(`${API}/app-settings/timezones`);
      setTimezones(response.data.timezones);
    } catch (error) {
      console.error('Error fetching timezones:', error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await axios.get(`${API}/app-settings/currencies`);
      setCurrencies(response.data.currencies);
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const updateSettings = async (updates) => {
    try {
      const response = await axios.put(`${API}/app-settings`, updates);
      setSettings({
        ...response.data,
        loading: false
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: error.message };
    }
  };

  const formatCurrency = (amount) => {
    const { currency_symbol, decimal_places } = settings;
    if (decimal_places === 0) {
      return `${currency_symbol}${amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `${currency_symbol}${amount.toLocaleString('es-CL', { minimumFractionDigits: decimal_places, maximumFractionDigits: decimal_places })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const { date_format } = settings;
    
    if (date_format === 'DD/MM/YYYY') {
      return date.toLocaleDateString('es-CL');
    }
    return date.toLocaleDateString('en-US');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-CL');
  };

  return (
    <AppSettingsContext.Provider value={{
      settings,
      timezones,
      currencies,
      updateSettings,
      formatCurrency,
      formatDate,
      formatDateTime,
      refreshSettings: fetchSettings
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return context;
};
