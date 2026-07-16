import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const AccountContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
};

export const AccountProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && token) {
      fetchAccount();
    } else {
      setAccount(null);
      setLoading(false);
    }
  }, [user, token]);

  const fetchAccount = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/super-admin/my-account`);
      setAccount(response.data);
    } catch (error) {
      console.error('Error fetching account:', error);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAccount = async () => {
    await fetchAccount();
  };

  return (
    <AccountContext.Provider value={{ account, loading, refreshAccount }}>
      {children}
    </AccountContext.Provider>
  );
};
