import React from 'react';
import { Database } from 'lucide-react';
import ImportProducts from '../ImportProducts';

const ImportTab = () => {
  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-8"
      style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6" />
        <h2 className="text-2xl font-bold text-slate-900">Importar Datos</h2>
      </div>
      
      <div className="bg-blue-50 border-2 border-blue-900 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>📥 Importa productos masivamente desde Excel</strong><br/>
          Descarga la plantilla, complétala con tus productos y súbela para importarlos automáticamente.
        </p>
      </div>

      <ImportProducts />
    </div>
  );
};

export default ImportTab;
