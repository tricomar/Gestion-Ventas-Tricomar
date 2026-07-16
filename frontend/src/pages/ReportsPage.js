import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Home, FileDown, Calendar, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStores } from '../hooks/useStores';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStoreName } = useStores();
  const [period, setPeriod] = useState('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Verificar permisos - Empleados no tienen acceso
  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    if (isEmployee) {
      toast.error('No tienes acceso a esta sección');
      navigate('/');
    }
  }, [isEmployee, navigate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API}/reports/data?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const response = await axios.get(url);
      setReportData(response.data);
      toast.success('Reporte generado');
    } catch (error) {
      toast.error('Error al generar reporte');
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Reporte de Ventas', 14, 22);
    
    // Period info
    doc.setFontSize(11);
    doc.text(`Período: ${reportData.period}`, 14, 32);
    doc.text(`Desde: ${new Date(reportData.start_date).toLocaleDateString('es-CL')}`, 14, 38);
    doc.text(`Hasta: ${new Date(reportData.end_date).toLocaleDateString('es-CL')}`, 14, 44);
    
    // Summary
    doc.setFontSize(14);
    doc.text('Resumen por Tienda', 14, 54);
    
    const summaryData = [
      ['Tienda', 'Ventas', 'Total', 'Costo'],
      [getStoreName('A'), reportData.store_a.sales_count, `$${reportData.store_a.total_sales.toLocaleString('es-CL')}`, `$${reportData.store_a.total_cost.toLocaleString('es-CL')}`],
      [getStoreName('B'), reportData.store_b.sales_count, `$${reportData.store_b.total_sales.toLocaleString('es-CL')}`, `$${reportData.store_b.total_cost.toLocaleString('es-CL')}`],
      ['Total Egresos', '', `$${reportData.total_expenses.toLocaleString('es-CL')}`, ''],
      ['Total Otros Ingresos', '', `$${reportData.total_other_income.toLocaleString('es-CL')}`, ''],
    ];
    
    doc.autoTable({
      startY: 58,
      head: [summaryData[0]],
      body: summaryData.slice(1),
    });
    
    // Sales detail
    if (reportData.sales.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Detalle de Ventas', 14, 22);
      
      const salesData = reportData.sales.map(sale => [
        new Date(sale.created_at).toLocaleDateString('es-CL'),
        sale.product_name || 'N/A',
        sale.store,
        sale.quantity,
        `$${sale.price.toLocaleString('es-CL')}`,
        `$${sale.total.toLocaleString('es-CL')}`,
        sale.payment_method,
        sale.has_tax ? 'Sí' : 'No'
      ]);
      
      doc.autoTable({
        startY: 26,
        head: [['Fecha', 'Producto', 'Tienda', 'Cant.', 'Precio', 'Total', 'Pago', 'IVA']],
        body: salesData,
        styles: { fontSize: 8 }
      });
    }
    
    doc.save(`reporte-${period}-${Date.now()}.pdf`);
    toast.success('PDF descargado');
  };

  const downloadExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['REPORTE DE VENTAS'],
      ['Período', reportData.period],
      ['Desde', new Date(reportData.start_date).toLocaleDateString('es-CL')],
      ['Hasta', new Date(reportData.end_date).toLocaleDateString('es-CL')],
      [],
      ['RESUMEN POR TIENDA'],
      ['Tienda', 'Cant. Ventas', 'Total Ventas', 'Total Costo'],
      [getStoreName('A'), reportData.store_a.sales_count, reportData.store_a.total_sales, reportData.store_a.total_cost],
      [getStoreName('B'), reportData.store_b.sales_count, reportData.store_b.total_sales, reportData.store_b.total_cost],
      [],
      ['Total Egresos', '', reportData.total_expenses, ''],
      ['Total Otros Ingresos', '', reportData.total_other_income, '']
    ];
    
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Resumen');
    
    // Sales detail sheet
    if (reportData.sales.length > 0) {
      const salesData = reportData.sales.map(sale => ({
        Fecha: new Date(sale.created_at).toLocaleDateString('es-CL'),
        Producto: sale.product_name || 'N/A',
        Tienda: sale.store,
        Cantidad: sale.quantity,
        Precio: sale.price,
        Total: sale.total,
        'Método Pago': sale.payment_method,
        'Con IVA': sale.has_tax ? 'Sí' : 'No',
        Cliente: sale.customer || ''
      }));
      
      const salesWS = XLSX.utils.json_to_sheet(salesData);
      XLSX.utils.book_append_sheet(wb, salesWS, 'Ventas');
    }
    
    // Expenses sheet
    if (reportData.expenses.length > 0) {
      const expensesData = reportData.expenses.map(exp => ({
        Fecha: new Date(exp.created_at).toLocaleDateString('es-CL'),
        Descripción: exp.description,
        Monto: exp.amount,
        Categoría: exp.category,
        Usuario: exp.user_name
      }));
      
      const expensesWS = XLSX.utils.json_to_sheet(expensesData);
      XLSX.utils.book_append_sheet(wb, expensesWS, 'Egresos');
    }
    
    XLSX.writeFile(wb, `reporte-${period}-${Date.now()}.xlsx`);
    toast.success('Excel descargado');
  };

  // Mostrar mensaje de acceso denegado para empleados
  if (isEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto mt-20">
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-8 text-center"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
            <p className="text-slate-600 mb-6">
              No tienes permisos para acceder a la sección de Reportes.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-slate-900 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-800 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: '#F4F4F0', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="back-to-dashboard-btn"
          >
            <Home className="w-5 h-5" />
          </button>
          <div>
            <h1 
              className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
            >
              Reportes
            </h1>
            <p className="text-base font-medium text-slate-600">Genera reportes descargables</p>
          </div>
        </div>
      </div>

      {/* Report Generator */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8 mb-6"
        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      >
        <h2 className="text-xl font-bold mb-6">Generar Reporte</h2>
        
        {/* Period Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {['day', 'week', 'month', 'custom'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                period === p ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
              data-testid={`period-${p}-btn`}
            >
              {p === 'day' && 'Hoy'}
              {p === 'week' && 'Esta Semana'}
              {p === 'month' && 'Este Mes'}
              {p === 'custom' && 'Personalizado'}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {period === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium"
                data-testid="start-date-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium"
                data-testid="end-date-input"
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={fetchReport}
          disabled={loading || (period === 'custom' && (!startDate || !endDate))}
          className="w-full text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
          style={{
            backgroundColor: '#D4F0A5',
            boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
          }}
          data-testid="generate-report-btn"
        >
          <Calendar className="inline w-5 h-5 mr-2" />
          {loading ? 'Generando...' : 'Generar Reporte'}
        </button>
      </div>

      {/* Report Results */}
      {reportData && (
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h2 className="text-xl font-bold mb-6">Resumen del Reporte</h2>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 border-2 border-slate-900 rounded-xl" style={{ backgroundColor: '#D4F0A5' }}>
              <h3 className="font-bold text-sm uppercase mb-2">{getStoreName('A')}</h3>
              <p className="text-2xl font-black font-mono">${reportData.store_a.total_sales.toLocaleString('es-CL')}</p>
              <p className="text-sm">{ reportData.store_a.sales_count} ventas</p>
            </div>
            <div className="p-4 border-2 border-slate-900 rounded-xl" style={{ backgroundColor: '#FADBB0' }}>
              <h3 className="font-bold text-sm uppercase mb-2">{getStoreName('B')}</h3>
              <p className="text-2xl font-black font-mono">${reportData.store_b.total_sales.toLocaleString('es-CL')}</p>
              <p className="text-sm">{reportData.store_b.sales_count} ventas</p>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex gap-4">
            <button
              onClick={downloadPDF}
              className="flex-1 bg-white text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              data-testid="download-pdf-btn"
            >
              <FileDown className="inline w-5 h-5 mr-2" />
              Descargar PDF
            </button>
            <button
              onClick={downloadExcel}
              className="flex-1 bg-white text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              data-testid="download-excel-btn"
            >
              <FileDown className="inline w-5 h-5 mr-2" />
              Descargar Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
