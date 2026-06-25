import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const NotesCalendar = ({ onDateSelect, selectedDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const fetchCalendarData = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await axios.get(`${API}/notes/calendar/days?year=${year}&month=${month}`);
      setCalendarData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    const selected = new Date(selectedDate);
    return day === selected.getDate() && 
           currentDate.getMonth() === selected.getMonth() && 
           currentDate.getFullYear() === selected.getFullYear();
  };

  const getDayColor = (day) => {
    const dayData = calendarData[day];
    if (!dayData) return null;

    // Priority: unread > pending > read > completed
    const { statuses } = dayData;
    
    if (statuses.unread > 0) return '#FFE5B4'; // Amarillo claro
    if (statuses.pending > 0) return '#FADBB0'; // Naranja claro
    if (statuses.read > 0) return '#E0E7FF'; // Azul claro
    if (statuses.completed > 0) return '#D1FAE5'; // Verde claro
    
    return null;
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    onDateSelect(dateStr);
  };

  const days = getDaysInMonth();

  return (
    <div className="border-2 border-slate-900 rounded-xl bg-white p-4" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          Calendario de Notas
        </h3>
        <button
          onClick={goToToday}
          className="px-3 py-1 text-xs font-bold border-2 border-slate-900 rounded-lg bg-white hover:bg-slate-50"
          style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
        >
          Hoy
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 border-2 border-slate-900 rounded-lg hover:bg-slate-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <span className="text-base font-bold text-slate-900">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </span>
        
        <button
          onClick={goToNextMonth}
          className="p-2 border-2 border-slate-900 rounded-lg hover:bg-slate-50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-bold text-slate-600">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const dayColor = day ? getDayColor(day) : null;
          const hasNotes = day && calendarData[day];
          
          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              disabled={!day}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm font-bold
                border-2 transition-all relative
                ${!day ? 'invisible' : ''}
                ${isToday(day) ? 'border-blue-500 border-4' : 'border-slate-900'}
                ${isSelected(day) ? 'ring-4 ring-slate-900' : ''}
                ${day && !hasNotes ? 'bg-white hover:bg-slate-50' : ''}
                ${hasNotes ? 'hover:scale-105' : ''}
              `}
              style={{
                backgroundColor: dayColor || 'white',
                boxShadow: hasNotes ? '3px 3px 0px 0px rgba(15,23,42,1)' : '2px 2px 0px 0px rgba(15,23,42,0.2)'
              }}
            >
              {day}
              {hasNotes && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-slate-900 rounded-full animate-pulse"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t-2 border-slate-200">
        <p className="text-xs font-bold text-slate-600 mb-2">Leyenda:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-slate-900" style={{ backgroundColor: '#FFE5B4' }}></div>
            <span>Sin leer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-slate-900" style={{ backgroundColor: '#FADBB0' }}></div>
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-slate-900" style={{ backgroundColor: '#E0E7FF' }}></div>
            <span>Leída</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-slate-900" style={{ backgroundColor: '#D1FAE5' }}></div>
            <span>Completada</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesCalendar;
