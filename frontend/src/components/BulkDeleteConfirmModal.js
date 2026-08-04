import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

const BulkDeleteConfirmModal = ({ 
  selectedCount, 
  onConfirm, 
  onCancel, 
  isDeleting 
}) => {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmValid = confirmText.toLowerCase() === 'eliminar';

  // NO limpiar el texto cuando cambia el contador
  // El usuario puede agregar/quitar productos sin perder lo que escribió

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-white border-4 border-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{ 
          boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)',
          animation: 'slideDown 0.3s ease-out'
        }}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-900" />
        </button>

        {/* Icon and title */}
        <div className="flex items-start gap-4 mb-6">
          <div 
            className="p-3 bg-red-100 border-2 border-slate-900 rounded-xl"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">
              Confirmar Eliminación
            </h2>
            <p className="text-slate-600 font-medium">
              Esta acción no se puede deshacer
            </p>
          </div>
        </div>

        {/* Selected count badge */}
        <div 
          className="mb-6 p-4 bg-red-50 border-2 border-slate-900 rounded-xl"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-700 font-bold">
              Productos a eliminar:
            </span>
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span className="text-3xl font-black text-red-600">
                {selectedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Confirmation input */}
        <div className="mb-6">
          <label className="block mb-2 font-bold text-slate-900">
            Escribe <span className="text-red-600">eliminar</span> para confirmar:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="eliminar"
            disabled={isDeleting}
            className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-mono text-lg focus:outline-none focus:ring-4 focus:ring-red-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
            autoFocus
          />
          {confirmText && !isConfirmValid && (
            <p className="mt-2 text-sm text-red-600 font-medium">
              Debes escribir exactamente "eliminar"
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="flex-1 px-4 py-3 bg-red-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            {isDeleting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Eliminando...
              </span>
            ) : (
              `Eliminar ${selectedCount}`
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default BulkDeleteConfirmModal;
