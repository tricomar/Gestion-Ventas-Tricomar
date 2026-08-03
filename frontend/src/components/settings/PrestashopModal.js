import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Check, Loader, ShoppingCart, RefreshCw, Package, Tag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PrestashopModal = ({ isOpen, onClose, integration, onSuccess, stores }) => {
  const [step, setStep] = useState(1); // 1: Conexión, 2: Sincronización
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Formulario de conexión
  const [shopUrl, setShopUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // Sincronización
  const [integrationId, setIntegrationId] = useState(null);
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);

  useEffect(() => {
    if (integration) {
      setShopUrl(integration.shop_url);
      setSelectedStoreId(integration.store_id);
      setIntegrationId(integration.id);
      setConnectionStatus('connected');
      setStep(2); // Si ya existe integración, ir directo a sincronización
    }
  }, [integration]);

  const handleTestConnection = async () => {
    if (!shopUrl || !apiKey) {
      toast.error('Completa todos los campos');
      return;
    }

    setTesting(true);
    try {
      // Intentar conectar (esto también valida la conexión)
      await axios.post(`${API}/integrations/prestashop/connect`, {
        shop_url: shopUrl,
        api_key: apiKey,
        store_id: selectedStoreId
      });
      
      setConnectionStatus('success');
      toast.success('✓ Conexión exitosa con PrestaShop');
    } catch (error) {
      setConnectionStatus('error');
      
      // Manejar diferentes tipos de errores
      let errorMsg = 'Error al conectar con PrestaShop';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Si es un error de validación de Pydantic (422)
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    
    if (!shopUrl || !apiKey || !selectedStoreId) {
      toast.error('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/integrations/prestashop/connect`, {
        shop_url: shopUrl,
        api_key: apiKey,
        store_id: selectedStoreId
      });
      
      setIntegrationId(response.data.integration_id);
      setConnectionStatus('connected');
      toast.success('Integración configurada exitosamente');
      setStep(2); // Pasar a sincronización
    } catch (error) {
      // Manejar diferentes tipos de errores
      let errorMsg = 'Error al configurar integración';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Si es un error de validación de Pydantic (422)
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCategories = async () => {
    if (!integrationId) return;

    setSyncingCategories(true);
    try {
      const response = await axios.post(
        `${API}/integrations/prestashop/${integrationId}/sync-categories`
      );
      
      setCategoriesCount(response.data.synced_count);
      toast.success(`✓ ${response.data.synced_count} categorías sincronizadas`);
    } catch (error) {
      // Manejar diferentes tipos de errores
      let errorMsg = 'Error al sincronizar categorías';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
    } finally {
      setSyncingCategories(false);
    }
  };

  const handleSyncProducts = async () => {
    if (!integrationId) return;

    setSyncingProducts(true);
    try {
      const response = await axios.post(
        `${API}/integrations/prestashop/${integrationId}/sync-products`
      );
      
      setProductsCount(response.data.synced_count);
      toast.success(`✓ ${response.data.synced_count} productos sincronizados`, {
        duration: 5000
      });
    } catch (error) {
      // Manejar diferentes tipos de errores
      let errorMsg = 'Error al sincronizar productos';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-white border-4 border-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-4 flex justify-between items-center border-b-4 border-slate-900">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <h2 className="text-xl font-bold">
                {integration ? 'Configurar' : 'Conectar'} PrestaShop
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Steps indicator */}
          <div className="px-6 py-4 bg-slate-50 border-b-2 border-slate-200">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-pink-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                  step >= 1 ? 'bg-pink-100 border-pink-600' : 'border-slate-300'
                }`}>
                  {connectionStatus === 'connected' ? <Check className="w-5 h-5" /> : '1'}
                </div>
                <span className="font-semibold text-sm">Conexión</span>
              </div>
              
              <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-pink-600' : 'bg-slate-300'}`} />
              
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-pink-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                  step >= 2 ? 'bg-pink-100 border-pink-600' : 'border-slate-300'
                }`}>
                  2
                </div>
                <span className="font-semibold text-sm">Sincronización</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 && (
              <form onSubmit={handleConnect} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    URL de tu tienda PrestaShop
                  </label>
                  <input
                    type="url"
                    value={shopUrl}
                    onChange={(e) => setShopUrl(e.target.value)}
                    placeholder="https://tu-tienda.com"
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Ejemplo: https://tricomarpets.cl
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    API Key de PrestaShop
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="WN6A2FY5787TFLFXQ16VTM21377PDU5V"
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Encuentra tu API Key en: PrestaShop → Parámetros Avanzados → Webservice
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Tienda/Caja asociada
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  >
                    <option value="">Selecciona una tienda...</option>
                    {stores && stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Esta será el canal de ventas de PrestaShop
                  </p>
                </div>

                {connectionStatus === 'error' && (
                  <div className="bg-red-50 border-2 border-red-600 rounded-lg p-4">
                    <p className="text-sm text-red-900 font-semibold">
                      ✗ No se pudo conectar. Verifica la URL y API Key.
                    </p>
                  </div>
                )}

                {connectionStatus === 'success' && (
                  <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4">
                    <p className="text-sm text-green-900 font-semibold">
                      ✓ Conexión exitosa con PrestaShop
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !shopUrl || !apiKey || !selectedStoreId}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-100 text-blue-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {testing ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Probar Conexión
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={loading || connectionStatus !== 'success'}
                    className="flex-1 flex items-center justify-center gap-2 bg-pink-500 text-white border-2 border-slate-900 rounded-xl px-6 py-3 font-bold hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        Conectar y Continuar
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-blue-50 border-2 border-blue-900 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>🔄 Sincronización Inicial</strong><br/>
                    Importa categorías y productos desde tu tienda PrestaShop. Este proceso puede tardar unos minutos.
                  </p>
                </div>

                {/* Sincronizar Categorías */}
                <div className="border-2 border-slate-900 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Tag className="w-6 h-6 text-purple-600" />
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Categorías</h3>
                        <p className="text-sm text-slate-600">Importar categorías de productos</p>
                      </div>
                    </div>
                    {categoriesCount > 0 && (
                      <span className="px-3 py-1 bg-green-100 border-2 border-green-600 rounded-full text-sm font-bold text-green-800">
                        {categoriesCount} sincronizadas
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={handleSyncCategories}
                    disabled={syncingCategories}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white border-2 border-slate-900 rounded-xl px-6 py-3 font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    {syncingCategories ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Sincronizar Categorías
                      </>
                    )}
                  </button>
                </div>

                {/* Sincronizar Productos */}
                <div className="border-2 border-slate-900 rounded-xl p-6 bg-gradient-to-br from-green-50 to-green-100">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Package className="w-6 h-6 text-green-600" />
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Productos</h3>
                        <p className="text-sm text-slate-600">Importar productos con precios y stock</p>
                      </div>
                    </div>
                    {productsCount > 0 && (
                      <span className="px-3 py-1 bg-green-100 border-2 border-green-600 rounded-full text-sm font-bold text-green-800">
                        {productsCount} sincronizados
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={handleSyncProducts}
                    disabled={syncingProducts}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white border-2 border-slate-900 rounded-xl px-6 py-3 font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    {syncingProducts ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Sincronizar Productos
                      </>
                    )}
                  </button>
                </div>

                {(categoriesCount > 0 || productsCount > 0) && (
                  <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4">
                    <p className="text-sm text-green-900 font-semibold mb-2">
                      ✓ Sincronización completada
                    </p>
                    <p className="text-xs text-green-800">
                      Los productos se sincronizarán automáticamente cada 15 minutos.
                      El stock se actualizará en PrestaShop cuando registres ventas locales.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-200">
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-slate-100 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleFinish}
                    className="px-6 py-3 bg-pink-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-pink-600 transition-colors"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PrestashopModal;
