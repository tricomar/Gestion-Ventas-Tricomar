/**
 * Context global para datos frecuentes del sistema
 * Provee cache inteligente para categorías, tiendas, clientes, estados, etc.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DataContext = createContext();

// Hook personalizado para usar el contexto
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData debe ser usado dentro de DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  // Estados de datos
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [prestashopIntegrations, setPrestashopIntegrations] = useState([]);
  
  // Estados de carga
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  
  // Timestamps para cache invalidation
  const [lastFetchCategories, setLastFetchCategories] = useState(null);
  const [lastFetchProducts, setLastFetchProducts] = useState(null);
  const [lastFetchCustomers, setLastFetchCustomers] = useState(null);
  const [lastFetchIntegrations, setLastFetchIntegrations] = useState(null);
  
  // Configuración de cache (5 minutos por defecto)
  const CACHE_DURATION_MS = 5 * 60 * 1000;
  
  // ========================================================================
  // CATEGORÍAS
  // ========================================================================
  
  const fetchCategories = useCallback(async (force = false) => {
    // Verificar si el cache es válido
    if (!force && lastFetchCategories && (Date.now() - lastFetchCategories < CACHE_DURATION_MS)) {
      return; // Cache válido, no hacer fetch
    }
    
    setLoadingCategories(true);
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data || []);
      setLastFetchCategories(Date.now());
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, [lastFetchCategories]);
  
  const refreshCategories = () => fetchCategories(true);
  
  // ========================================================================
  // PRODUCTOS
  // ========================================================================
  
  const fetchProducts = useCallback(async (force = false) => {
    if (!force && lastFetchProducts && (Date.now() - lastFetchProducts < CACHE_DURATION_MS)) {
      return;
    }
    
    setLoadingProducts(true);
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data || []);
      setLastFetchProducts(Date.now());
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [lastFetchProducts]);
  
  const refreshProducts = () => fetchProducts(true);
  
  // ========================================================================
  // CLIENTES
  // ========================================================================
  
  const fetchCustomers = useCallback(async (force = false) => {
    if (!force && lastFetchCustomers && (Date.now() - lastFetchCustomers < CACHE_DURATION_MS)) {
      return;
    }
    
    setLoadingCustomers(true);
    try {
      const response = await axios.get(`${API}/customers`);
      setCustomers(response.data || []);
      setLastFetchCustomers(Date.now());
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, [lastFetchCustomers]);
  
  const refreshCustomers = () => fetchCustomers(true);
  
  // ========================================================================
  // INTEGRACIONES PRESTASHOP
  // ========================================================================
  
  const fetchPrestashopIntegrations = useCallback(async (force = false) => {
    if (!force && lastFetchIntegrations && (Date.now() - lastFetchIntegrations < CACHE_DURATION_MS)) {
      return;
    }
    
    setLoadingIntegrations(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/integrations/prestashop/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPrestashopIntegrations(response.data || []);
      setLastFetchIntegrations(Date.now());
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setPrestashopIntegrations([]);
    } finally {
      setLoadingIntegrations(false);
    }
  }, [lastFetchIntegrations]);
  
  const refreshIntegrations = () => fetchPrestashopIntegrations(true);
  
  // ========================================================================
  // INVALIDAR CACHE (llamar después de crear/editar/eliminar)
  // ========================================================================
  
  const invalidateCategories = () => {
    setLastFetchCategories(null);
    fetchCategories(true);
  };
  
  const invalidateProducts = () => {
    setLastFetchProducts(null);
    fetchProducts(true);
  };
  
  const invalidateCustomers = () => {
    setLastFetchCustomers(null);
    fetchCustomers(true);
  };
  
  const invalidateIntegrations = () => {
    setLastFetchIntegrations(null);
    fetchPrestashopIntegrations(true);
  };
  
  const invalidateAll = () => {
    invalidateCategories();
    invalidateProducts();
    invalidateCustomers();
    invalidateIntegrations();
  };
  
  // ========================================================================
  // PRE-CARGA INICIAL AL MONTAR
  // ========================================================================
  
  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchCustomers();
    fetchPrestashopIntegrations();
  }, []);
  
  // ========================================================================
  // REFRESH AUTOMÁTICO CADA 5 MINUTOS (opcional)
  // ========================================================================
  
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCategories();
      fetchProducts();
      fetchCustomers();
      fetchPrestashopIntegrations();
    }, CACHE_DURATION_MS);
    
    return () => clearInterval(interval);
  }, [fetchCategories, fetchProducts, fetchCustomers, fetchPrestashopIntegrations]);
  
  // ========================================================================
  // VALOR DEL CONTEXTO
  // ========================================================================
  
  const value = {
    // Datos
    categories,
    products,
    customers,
    prestashopIntegrations,
    
    // Estados de carga
    loadingCategories,
    loadingProducts,
    loadingCustomers,
    loadingIntegrations,
    
    // Funciones de refresh manual
    refreshCategories,
    refreshProducts,
    refreshCustomers,
    refreshIntegrations,
    
    // Funciones de invalidación (después de mutations)
    invalidateCategories,
    invalidateProducts,
    invalidateCustomers,
    invalidateIntegrations,
    invalidateAll,
    
    // Helpers
    isLoading: loadingCategories || loadingProducts || loadingCustomers || loadingIntegrations
  };
  
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
