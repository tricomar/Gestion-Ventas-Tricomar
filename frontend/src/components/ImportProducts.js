import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ImportProducts = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/import-export/products/template`, {
        responseType: 'blob'
      });
      
      // Crear un enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `plantilla_productos_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Plantilla descargada correctamente');
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validar que sea un archivo Excel
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Por favor selecciona un archivo Excel (.xlsx o .xls)');
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Por favor selecciona un archivo');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(`${API}/import-export/products/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
      
      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedFile(null);
        // Reset file input
        document.getElementById('file-input').value = '';
      }
    } catch (error) {
      console.error('Error al importar productos:', error);
      const errorMessage = error.response?.data?.detail || 'Error al importar productos';
      toast.error(errorMessage);
      setImportResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sección 1: Descargar Plantilla */}
      <div className="border-2 border-slate-900 rounded-xl p-6 bg-slate-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Paso 1: Descarga la Plantilla</h3>
            <p className="text-sm text-slate-600 mb-4">
              Descarga el archivo Excel con el formato correcto para importar tus productos.
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg font-bold hover:bg-[#c5e196] transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <Download className="w-5 h-5" />
              Descargar Plantilla Excel
            </button>
          </div>
        </div>
      </div>

      {/* Sección 2: Completar Plantilla */}
      <div className="border-2 border-slate-900 rounded-xl p-6 bg-slate-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#FADBB0] border-2 border-slate-900 rounded-lg">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Paso 2: Completa la Información</h3>
            <p className="text-sm text-slate-600 mb-3">
              Abre el archivo descargado y completa los datos de tus productos:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              <li>• <strong>Nombre del Producto:</strong> Nombre descriptivo (requerido)</li>
              <li>• <strong>Código de Tienda:</strong> Debe coincidir con tus tiendas configuradas (requerido)</li>
              <li>• <strong>Precio de Compra:</strong> Costo del producto (requerido)</li>
              <li>• <strong>Precio de Venta:</strong> Precio al cliente (requerido)</li>
              <li>• <strong>Stock Disponible:</strong> Cantidad en inventario (opcional)</li>
              <li>• <strong>Categoría:</strong> Clasificación del producto (opcional)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sección 3: Subir Archivo */}
      <div className="border-2 border-slate-900 rounded-xl p-6 bg-slate-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#FFE4E6] border-2 border-slate-900 rounded-lg">
            <Upload className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Paso 3: Sube el Archivo</h3>
            <p className="text-sm text-slate-600 mb-4">
              Selecciona el archivo Excel completado y haz clic en "Importar".
            </p>
            
            {/* File Input */}
            <div className="flex items-center gap-4 mb-4">
              <label 
                htmlFor="file-input"
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-all cursor-pointer"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                <FileSpreadsheet className="w-5 h-5" />
                {selectedFile ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
              </label>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile && (
                <span className="text-sm font-medium text-slate-700">
                  {selectedFile.name}
                </span>
              )}
            </div>

            {/* Import Button */}
            <button
              onClick={handleImport}
              disabled={!selectedFile || importing}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold border-2 border-slate-900 transition-all ${
                !selectedFile || importing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#D4F0A5] hover:bg-[#c5e196]'
              }`}
              style={{ 
                boxShadow: !selectedFile || importing ? 'none' : '4px 4px 0px 0px rgba(15,23,42,1)' 
              }}
            >
              <Upload className="w-5 h-5" />
              {importing ? 'Importando...' : 'Importar Productos'}
            </button>
          </div>
        </div>
      </div>

      {/* Resultado de la Importación */}
      {importResult && (
        <div className={`border-2 border-slate-900 rounded-xl p-6 ${
          importResult.success ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 border-2 border-slate-900 rounded-lg ${
              importResult.success ? 'bg-green-200' : 'bg-red-200'
            }`}>
              {importResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-900" />
              ) : (
                <XCircle className="w-6 h-6 text-red-900" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold mb-2 ${
                importResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {importResult.success ? 'Importación Exitosa' : 'Error en Importación'}
              </h3>
              
              {importResult.success && (
                <div className="space-y-2 text-sm">
                  <p className="text-green-900">
                    ✅ <strong>{importResult.products_added}</strong> productos agregados
                  </p>
                  <p className="text-green-900">
                    🔄 <strong>{importResult.products_updated}</strong> productos actualizados
                  </p>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-bold text-amber-900">
                      Advertencias ({importResult.errors.length}):
                    </p>
                  </div>
                  <div className="bg-white border border-amber-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <ul className="text-xs text-amber-900 space-y-1">
                      {importResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {!importResult.success && importResult.message && (
                <p className="text-sm text-red-900 mt-2">
                  {importResult.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportProducts;
