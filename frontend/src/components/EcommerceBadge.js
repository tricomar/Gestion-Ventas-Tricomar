import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EcommerceBadge = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchBadgeCount();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchBadgeCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchBadgeCount = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/badge-count`);
      setCount(response.data.count);
    } catch (error) {
      console.error('Error fetching badge count:', error);
    }
  };

  if (count === 0) return null;

  return (
    <span 
      className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full ml-2"
      style={{
        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default EcommerceBadge;
