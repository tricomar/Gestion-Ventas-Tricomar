import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { token } = useAuth(); // Get token from AuthContext
  const [settings, setSettings] = useState({
    store_a_name: 'Tienda A',
    store_b_name: 'Tienda B'
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      if (authToken) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        const response = await axios.get(`${API}/settings`);
        setSettings({
          store_a_name: response.data.store_a_name,
          store_b_name: response.data.store_b_name
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch settings when token changes (user logs in)
  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [token]);

  const refreshSettings = () => {
    fetchSettings();
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
