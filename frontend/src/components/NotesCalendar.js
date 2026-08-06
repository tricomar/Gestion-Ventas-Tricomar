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
    // Colores neobrutalistas más vibrantes
    const { statuses } = dayData;
    
    if (statuses.unread > 0) return '#FDE047'; // Amarillo vibrante
    if (statuses.pending > 0) return '#FB923C'; // Naranja vibrante
    if (statuses.read > 0) return '#A78BFA'; // Púrpura vibrante
    if (statuses.completed > 0) return '#4ADE80'; // Verde vibrante
    
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
    <div className="border-2 border-slate-900 rounded-xl bg-white p-3" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Calendario
        </h3>
        <button
          onClick={goToToday}
          className="px-2 py-1 text-xs font-bold border-2 border-slate-900 rounded-lg bg-white hover:bg-slate-50"
          style={{ boxShadow: '1px 1px 0px 0px rgba(15,23,42,1)' }}
        >
          Hoy
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousMonth}
          className="p-1 border-2 border-slate-900 rounded-lg hover:bg-slate-50"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        
        <span className="text-xs font-bold text-slate-900">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </span>
        
        <button
          onClick={goToNextMonth}
          className="p-1 border-2 border-slate-900 rounded-lg hover:bg-slate-50"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-[10px] font-bold text-slate-600">
            {day.charAt(0)}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const dayColor = day ? getDayColor(day) : null;
          const hasNotes = day && calendarData[day];
          
          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              disabled={!day}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-[11px] font-bold
                border-2 transition-all relative
                ${!day ? 'invisible' : ''}
                ${isToday(day) ? 'border-blue-600 ring-2 ring-blue-400' : 'border-slate-900'}
                ${isSelected(day) ? 'ring-2 ring-indigo-500 scale-105' : ''}
                ${day && !hasNotes ? 'bg-white hover:bg-slate-50' : ''}
                ${hasNotes ? 'hover:scale-110 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]' : ''}
              `}
              style={{
                backgroundColor: dayColor || 'white',
                boxShadow: hasNotes ? '2px 2px 0px 0px rgba(15,23,42,1)' : '1px 1px 0px 0px rgba(15,23,42,0.3)'
              }}
            >
              {day}
              {hasNotes && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-slate-900 rounded-full border border-white"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend - Compact */}
      <div className="mt-3 pt-2 border-t-2 border-slate-900">
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-slate-900" style={{ backgroundColor: '#FDE047' }}></div>
            <span className="font-bold">Sin leer</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-slate-900" style={{ backgroundColor: '#FB923C' }}></div>
            <span className="font-bold">Pendiente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-slate-900" style={{ backgroundColor: '#A78BFA' }}></div>
            <span className="font-bold">Leída</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-slate-900" style={{ backgroundColor: '#4ADE80' }}></div>
            <span className="font-bold">Completada</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesCalendar;
