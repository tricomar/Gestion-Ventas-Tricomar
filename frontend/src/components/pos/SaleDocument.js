import React, { useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useSettings } from '../../context/SettingsContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const SaleDocument = ({ sale, onClose }) => {
  const { settings } = useSettings();
  const documentRef = useRef();
  const thermal80Ref = useRef();
  const thermal58Ref = useRef();

  // Imprimir A4
  const handlePrintA4 = useReactToPrint({
    content: () => documentRef.current,
    documentTitle: `Venta_${sale.sale_number}`,
  });

  // Imprimir 80mm
  const handlePrint80mm = useReactToPrint({
    content: () => thermal80Ref.current,
    documentTitle: `Ticket_${sale.sale_number}`,
    pageStyle: '@page { size: 80mm auto; margin: 0; }',
  });

  // Imprimir 58mm
  const handlePrint58mm = useReactToPrint({
    content: () => thermal58Ref.current,
    documentTitle: `Ticket_${sale.sale_number}`,
    pageStyle: '@page { size: 58mm auto; margin: 0; }',
  });

  // Descargar PDF A4
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Logo si existe
    if (settings?.company_logo) {
      try {
        doc.addImage(settings.company_logo, 'PNG', 15, 15, 30, 30);
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }
    
    // Encabezado
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.company_name || 'Negocio Feliz', 105, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('NOTA DE VENTA', 105, 35, { align: 'center' });
    
    // Info venta
    doc.setFontSize(10);
    doc.text(`N°: ${sale.sale_number}`, 15, 55);
    doc.text(`Fecha: ${new Date(sale.created_at).toLocaleString('es-CL')}`, 15, 62);
    doc.text(`Cliente: ${sale.customer_name}`, 15, 69);
    doc.text(`Método de Pago: ${sale.payment_method}`, 15, 76);
    
    // Tabla de productos
    const tableData = sale.items.map(item => [
      item.product_name,
      item.quantity,
      `$${item.unit_price.toLocaleString('es-CL')}`,
      `$${item.subtotal.toLocaleString('es-CL')}`
    ]);
    
    doc.autoTable({
      startY: 85,
      head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] },
    });
    
    // Totales
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text(`Subtotal (sin IVA): $${sale.subtotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`, 140, finalY);
    doc.text(`IVA (19%): $${sale.iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`, 140, finalY + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TOTAL: $${sale.total.toLocaleString('es-CL')}`, 140, finalY + 17);
    
    doc.save(`Venta_${sale.sale_number}.pdf`);
  };

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-8 overflow-y-auto">
        <div 
          className="bg-white border-4 border-slate-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-pink-500 border-b-4 border-slate-900 p-6 flex justify-between items-center">
            <h2 className="text-2xl font-black text-white">✅ Venta Completada</h2>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 border border-white rounded-lg hover:bg-white/30 transition-all"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-b-4 border-slate-900 bg-gradient-to-r from-yellow-50 to-orange-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <Download className="w-5 h-5" />
                PDF A4
              </button>
              
              <button
                onClick={handlePrintA4}
                className="px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <Printer className="w-5 h-5" />
                Imprimir A4
              </button>
              
              <button
                onClick={handlePrint80mm}
                className="px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <Printer className="w-5 h-5" />
                80mm
              </button>
              
              <button
                onClick={handlePrint58mm}
                className="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <Printer className="w-5 h-5" />
                58mm
              </button>
            </div>
          </div>

          {/* Document Preview A4 */}
          <div className="p-8">
            <div 
              ref={documentRef}
              className="bg-white border-2 border-slate-900 rounded-xl p-8"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              {/* Logo y Header */}
              <div className="flex items-start justify-between mb-8 pb-6 border-b-4 border-slate-900">
                <div className="flex items-center gap-4">
                  {settings?.company_logo ? (
                    <img 
                      src={settings.company_logo} 
                      alt="Logo" 
                      className="h-16 w-auto border-2 border-slate-900 rounded-lg"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-slate-900 rounded-lg flex items-center justify-center">
                      <span className="text-white font-black text-2xl">ERP</span>
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-black text-slate-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                      {settings?.company_name || 'Negocio Feliz'}
                    </h1>
                    <p className="text-slate-600 font-medium">Sistema de Gestión</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-slate-900 mb-2">NOTA DE VENTA</h2>
                  <p className="text-sm text-slate-600">N°: <span className="font-bold">{sale.sale_number}</span></p>
                </div>
              </div>

              {/* Info de Venta */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <p className="text-xs text-slate-600 font-medium mb-1">FECHA Y HORA</p>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(sale.created_at).toLocaleString('es-CL', { 
                      dateStyle: 'long', 
                      timeStyle: 'short' 
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium mb-1">CLIENTE</p>
                  <p className="text-sm font-bold text-slate-900">{sale.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium mb-1">MÉTODO DE PAGO</p>
                  <p className="text-sm font-bold text-slate-900">{sale.payment_method}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-medium mb-1">ID CARRITO</p>
                  <p className="text-sm font-mono font-bold text-slate-900">{sale.cart_id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              {/* Tabla de Productos */}
              <table className="w-full mb-8">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-slate-900">
                    <th className="px-4 py-3 text-left text-white font-black text-sm">PRODUCTO</th>
                    <th className="px-4 py-3 text-center text-white font-black text-sm">CANT.</th>
                    <th className="px-4 py-3 text-right text-white font-black text-sm">PRECIO UNIT.</th>
                    <th className="px-4 py-3 text-right text-white font-black text-sm">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, index) => (
                    <tr key={index} className="border-b-2 border-slate-900">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-slate-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                        ${item.unit_price.toLocaleString('es-CL')}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                        ${item.subtotal.toLocaleString('es-CL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totales */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-slate-900 rounded-xl p-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Subtotal (sin IVA):</span>
                    <span className="font-bold text-slate-900">
                      ${sale.subtotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">IVA (19%):</span>
                    <span className="font-bold text-slate-900">
                      ${sale.iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center">
                    <span className="text-2xl font-black text-slate-900">TOTAL:</span>
                    <span className="text-4xl font-black text-slate-900">
                      ${sale.total.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-slate-500 mt-8">
                ¡Gracias por su compra! • Sistema ERP Negocio Feliz
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Thermal 80mm Template */}
      <div style={{ display: 'none' }}>
        <div ref={thermal80Ref} style={{ width: '80mm', padding: '10mm', fontFamily: 'monospace' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '2px dashed #000', paddingBottom: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '5px 0' }}>
              {settings?.company_name || 'NEGOCIO FELIZ'}
            </h1>
            <p style={{ fontSize: '12px', margin: '2px 0' }}>NOTA DE VENTA</p>
            <p style={{ fontSize: '11px', margin: '2px 0' }}>N°: {sale.sale_number}</p>
          </div>
          
          <div style={{ fontSize: '11px', marginBottom: '10px' }}>
            <p><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleString('es-CL')}</p>
            <p><strong>Cliente:</strong> {sale.customer_name}</p>
            <p><strong>Pago:</strong> {sale.payment_method}</p>
          </div>
          
          <div style={{ borderTop: '2px dashed #000', borderBottom: '2px dashed #000', padding: '5px 0', marginBottom: '10px' }}>
            {sale.items.map((item, index) => (
              <div key={index} style={{ fontSize: '11px', marginBottom: '8px' }}>
                <p style={{ fontWeight: 'bold', margin: '2px 0' }}>{item.product_name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity} x ${item.unit_price.toLocaleString('es-CL')}</span>
                  <span style={{ fontWeight: 'bold' }}>${item.subtotal.toLocaleString('es-CL')}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ fontSize: '12px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span>Subtotal:</span>
              <span>${sale.subtotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>IVA (19%):</span>
              <span>${sale.iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', borderTop: '2px solid #000', paddingTop: '5px' }}>
              <span>TOTAL:</span>
              <span>${sale.total.toLocaleString('es-CL')}</span>
            </div>
          </div>
          
          <p style={{ textAlign: 'center', fontSize: '10px', marginTop: '15px' }}>
            ¡Gracias por su compra!
          </p>
        </div>
      </div>

      {/* Hidden Thermal 58mm Template */}
      <div style={{ display: 'none' }}>
        <div ref={thermal58Ref} style={{ width: '58mm', padding: '5mm', fontFamily: 'monospace', fontSize: '10px' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: '3px 0' }}>
              {settings?.company_name || 'NEGOCIO FELIZ'}
            </h1>
            <p style={{ fontSize: '10px', margin: '1px 0' }}>NOTA DE VENTA</p>
            <p style={{ fontSize: '9px', margin: '1px 0' }}>N°: {sale.sale_number}</p>
          </div>
          
          <div style={{ fontSize: '9px', marginBottom: '8px' }}>
            <p><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleString('es-CL')}</p>
            <p><strong>Cliente:</strong> {sale.customer_name}</p>
            <p><strong>Pago:</strong> {sale.payment_method}</p>
          </div>
          
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '8px' }}>
            {sale.items.map((item, index) => (
              <div key={index} style={{ fontSize: '9px', marginBottom: '6px' }}>
                <p style={{ fontWeight: 'bold', margin: '1px 0' }}>{item.product_name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity} x ${item.unit_price.toLocaleString('es-CL')}</span>
                  <span style={{ fontWeight: 'bold' }}>${item.subtotal.toLocaleString('es-CL')}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Subtotal:</span>
              <span>${sale.subtotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>IVA (19%):</span>
              <span>${sale.iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '4px' }}>
              <span>TOTAL:</span>
              <span>${sale.total.toLocaleString('es-CL')}</span>
            </div>
          </div>
          
          <p style={{ textAlign: 'center', fontSize: '8px', marginTop: '10px' }}>
            ¡Gracias!
          </p>
        </div>
      </div>
    </>
  );
};

export default SaleDocument;
