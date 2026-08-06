import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Trash2, Settings, ShoppingCart, Package, Download, Webhook } from 'lucide-react';
import PrestashopModal from './PrestashopModal';
import { useStores } from '../../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IntegrationsTab = () => {
  const { stores } = useStores();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrestashopModal, setShowPrestashopModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [webhookStatus, setWebhookStatus] = useState({}); // Estado de webhooks por integration_id

  useEffect(() => {
    fetchIntegrations();
  }, []);

  useEffect(() => {
    // Verificar estado de webhooks cada 30 segundos
    const interval = setInterval(() => {
      integrations.forEach(integration => {
        checkWebhookStatus(integration.id);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [integrations]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/integrations/prestashop/list`);
      setIntegrations(response.data);
      
      // Verificar estado de webhooks para cada integración
      response.data.forEach(integration => {
        checkWebhookStatus(integration.id);
      });
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Error al cargar integraciones');
    } finally {
      setLoading(false);
    }
  };

  const checkWebhookStatus = async (integrationId) => {
    try {
      // Verificar últimos eventos de webhook
      const response = await axios.get(`${API}/integrations/webhooks/prestashop/${integrationId}/status`);
      
      setWebhookStatus(prev => ({
        ...prev,
        [integrationId]: response.data
      }));
    } catch (error) {
      // Si no hay endpoint de status, usar lógica por defecto
      setWebhookStatus(prev => ({
        ...prev,
        [integrationId]: {
          status: 'unknown',
          message: 'No configurado'
        }
      }));
    }
  };

  const getWebhookStatusBadge = (integrationId) => {
    const status = webhookStatus[integrationId];
    
    if (!status) {
      return {
        color: 'gray',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-400',
        textColor: 'text-slate-700',
        label: 'Sin verificar',
        icon: '⚪'
      };
    }

    // Determinar estado basado en última actividad
    if (status.status === 'active') {
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-600',
        textColor: 'text-green-800',
        label: 'Webhook Activo',
        icon: '🟢'
      };
    } else if (status.status === 'inactive') {
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-600',
        textColor: 'text-yellow-800',
        label: 'Webhook Inactivo',
        icon: '🟡'
      };
    } else if (status.status === 'error') {
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-600',
        textColor: 'text-red-800',
        label: 'Webhook Error',
        icon: '🔴'
      };
    } else {
      return {
        color: 'gray',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-400',
        textColor: 'text-slate-700',
        label: 'No configurado',
        icon: '⚪'
      };
    }
  };

  const handleDeleteIntegration = async (integrationId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta integración? Se perderán todos los datos sincronizados.')) {
      return;
    }

    try {
      await axios.delete(`${API}/integrations/prestashop/${integrationId}`);
      toast.success('Integración eliminada exitosamente');
      fetchIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast.error('Error al eliminar integración');
    }
  };

  const handleConfigureIntegration = (integration) => {
    setSelectedIntegration(integration);
    setShowPrestashopModal(true);
  };

  const handleNewIntegration = () => {
    setSelectedIntegration(null);
    setShowPrestashopModal(true);
  };

  const handleDownloadModule = () => {
    const downloadUrl = `${API}/integrations/prestashop/download-module`;
    
    // Crear link temporal y hacer clic
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'emergent_webhooks.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Descargando módulo de PrestaShop...', {
      description: 'Instálalo en tu tienda para sincronización en tiempo real'
    });
  };

  const handleCopyWebhookUrl = (integrationId) => {
    const webhookUrl = `${BACKEND_URL}/api/integrations/webhooks/prestashop/${integrationId}`;
    
    // Copiar al portapapeles
    navigator.clipboard.writeText(webhookUrl).then(() => {
      toast.success('URL de Webhook copiada', {
        description: 'Pégala en la configuración del módulo PrestaShop',
        duration: 4000
      });
    }).catch(() => {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = webhookUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('URL de Webhook copiada');
      } catch (err) {
        toast.error('No se pudo copiar la URL');
      }
      document.body.removeChild(textArea);
    });
  };

  const ecommercePlatforms = [
    {
      id: 'prestashop',
      name: 'PrestaShop',
      icon: '🛒',
      color: 'from-pink-500 to-rose-600',
      description: 'Conecta con tu tienda PrestaShop',
      available: true
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      icon: '🌐',
      color: 'from-purple-500 to-indigo-600',
      description: 'Conecta con tu tienda WooCommerce',
      available: false
    },
    {
      id: 'shopify',
      name: 'Shopify',
      icon: '🛍️',
      color: 'from-green-500 to-teal-600',
      description: 'Conecta con tu tienda Shopify',
      available: false
    },
    {
      id: 'jumpseller',
      name: 'JumpSeller',
      icon: '📦',
      color: 'from-orange-500 to-amber-600',
      description: 'Conecta con tu tienda JumpSeller',
      available: false
    }
  ];

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-8"
      style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="w-6 h-6" />
        <h2 className="text-2xl font-bold text-slate-900">Integraciones Ecommerce</h2>
      </div>
      
      <div className="bg-blue-50 border-2 border-blue-900 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>🔗 Conecta tu negocio con plataformas ecommerce</strong><br/>
          Sincroniza productos, categorías y stock automáticamente con tus tiendas online.
        </p>
      </div>

      {/* Integraciones Activas */}
      {integrations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Integraciones Activas</h3>
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div 
                key={integration.id}
                className="border-2 border-slate-900 rounded-xl p-4 bg-gradient-to-r from-pink-50 to-rose-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-pink-500 border-2 border-slate-900 rounded-lg flex items-center justify-center text-2xl">
                        🛒
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">{integration.store_name}</h4>
                        <p className="text-sm text-slate-600">{integration.shop_url}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        {integration.is_active ? (
                          <span className="px-3 py-1 bg-green-100 border-2 border-green-600 rounded-full text-xs font-bold text-green-800 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Conectado
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-100 border-2 border-red-600 rounded-full text-xs font-bold text-red-800 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            Desconectado
                          </span>
                        )}
                        
                        {/* Badge de estado del webhook */}
                        {(() => {
                          const webhookBadge = getWebhookStatusBadge(integration.id);
                          return (
                            <span 
                              className={`px-3 py-1 ${webhookBadge.bgColor} border-2 ${webhookBadge.borderColor} rounded-full text-xs font-bold ${webhookBadge.textColor} flex items-center gap-1`}
                              title={webhookBadge.label}
                            >
                              <span>{webhookBadge.icon}</span>
                              {webhookBadge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-slate-600">Última sincronización:</p>
                        <p className="font-semibold text-slate-900">
                          {integration.last_sync_products 
                            ? new Date(integration.last_sync_products).toLocaleString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Nunca'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Intervalo:</p>
                        <p className="font-semibold text-slate-900">{integration.sync_interval_minutes} minutos</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Canal de ventas:</p>
                        <p className="font-semibold text-slate-900">PrestaShop</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleConfigureIntegration(integration)}
                      className="p-2 bg-blue-100 border-2 border-slate-900 rounded-lg hover:bg-blue-200 transition-colors"
                      title="Configurar"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={() => handleCopyWebhookUrl(integration.id)}
                      className="p-2 bg-purple-100 border-2 border-slate-900 rounded-lg hover:bg-purple-200 transition-colors"
                      title="Copiar URL de Webhook"
                    >
                      <Webhook className="w-5 h-5 text-purple-700" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteIntegration(integration.id)}
                      className="p-2 bg-red-100 border-2 border-slate-900 rounded-lg hover:bg-red-200 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plataformas Disponibles */}
      <h3 className="text-lg font-bold text-slate-900 mb-4">Plataformas Disponibles</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ecommercePlatforms.map((platform) => (
          <div
            key={platform.id}
            className={`border-2 border-slate-900 rounded-xl p-6 ${
              platform.available 
                ? 'cursor-pointer hover:scale-105 transition-transform' 
                : 'opacity-60 cursor-not-allowed'
            }`}
            style={{ 
              background: platform.available 
                ? `linear-gradient(135deg, var(--tw-gradient-stops))` 
                : '#f1f5f9',
              boxShadow: platform.available ? '4px 4px 0px 0px rgba(15,23,42,1)' : 'none'
            }}
            onClick={() => platform.available && platform.id === 'prestashop' && handleNewIntegration()}
          >
            <div className="text-center">
              <div className="text-5xl mb-3">{platform.icon}</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">{platform.name}</h4>
              <p className="text-xs text-slate-700 mb-4">{platform.description}</p>
              
              {platform.available ? (
                <div className="space-y-2">
                  <button 
                    className="w-full px-4 py-2 bg-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewIntegration();
                    }}
                  >
                    Conectar
                  </button>
                  
                  {platform.id === 'prestashop' && (
                    <button
                      className="w-full px-4 py-2 bg-green-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadModule();
                      }}
                      title="Descargar módulo de webhooks"
                    >
                      <Download className="w-4 h-4" />
                      Módulo Webhooks
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-4 py-2 bg-slate-300 border-2 border-slate-400 rounded-lg font-bold text-slate-600">
                  Próximamente
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de PrestaShop */}
      {showPrestashopModal && (
        <PrestashopModal
          isOpen={showPrestashopModal}
          onClose={() => {
            setShowPrestashopModal(false);
            setSelectedIntegration(null);
          }}
          integration={selectedIntegration}
          onSuccess={() => {
            fetchIntegrations();
            setShowPrestashopModal(false);
            setSelectedIntegration(null);
          }}
          stores={stores}
        />
      )}
    </div>
  );
};

export default IntegrationsTab;
