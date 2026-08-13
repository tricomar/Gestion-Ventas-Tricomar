import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, X, Save } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import PersonalizationSettings from './PersonalizationSettings';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PersonalizationTab = () => {
  const { settings, refreshSettings } = useSettings();
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  // Inicializar valores desde settings
  React.useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || '');
      setLogoPreview(settings.company_logo || null);
    }
  }, [settings]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes PNG, JPG o SVG');
      return;
    }

    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 2MB');
      return;
    }

    // Convertir a base64 y preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
      setLogoFile(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        company_name: companyName,
      };

      if (logoFile) {
        updateData.company_logo = logoFile;
      }

      await axios.patch(
        `${API}/settings/personalization`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      await refreshSettings();
      
      toast.success('✓ Personalización guardada exitosamente', {
        duration: 3000,
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
      
      setLogoFile(null);
    } catch (error) {
      console.error('Error saving personalization:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar la personalización');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">🎨 Personalización</h2>
        <p className="text-slate-600">Personaliza la identidad visual de tu negocio</p>
      </div>

      {/* Timezone and Currency Settings */}
      <PersonalizationSettings />

      {/* Company Name */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
      >
        <label className="block mb-3">
          <span className="text-sm font-bold text-slate-900 mb-2 block">Nombre de la Empresa</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ej: Mi Negocio S.A."
            className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </label>
        <p className="text-xs text-slate-500 mt-2">
          Este nombre aparecerá en el sistema y en los documentos impresos
        </p>
      </div>

      {/* Logo Upload - Diseño compacto */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-4">Logo de la Empresa</h3>
        
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Preview - Más pequeño */}
          <div className="w-full md:w-48">
            <p className="text-sm font-bold text-slate-900 mb-3">Vista Previa</p>
            <div 
              className="w-48 h-48 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-slate-900 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              {logoPreview ? (
                <div className="relative w-full h-full p-4">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    type="button"
                    className="absolute top-2 right-2 p-1.5 bg-red-500 border-2 border-slate-900 rounded-lg text-white hover:bg-red-600 transition-all"
                    style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin logo</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload - Más pequeño */}
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 mb-3">Subir Logo</p>
            <label 
              className="block w-full md:w-64 h-48 bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-dashed border-slate-900 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gradient-to-br hover:from-purple-200 hover:to-pink-200 transition-all"
            >
              <Upload className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-900 mb-1">Haz click para subir</p>
              <p className="text-xs text-slate-600 text-center px-4">
                PNG, JPG o SVG<br />
                Máximo 2MB
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-500 mt-3">
              💡 Recomendado: Logo cuadrado con fondo transparente
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <Save className="w-5 h-5" />
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
};

export default PersonalizationTab;
