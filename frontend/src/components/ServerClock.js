import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const ServerClock = () => {
  const [serverTime, setServerTime] = useState(new Date());

  // Update server time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    // Formatear hora en zona horaria local del servidor
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return serverTime.toLocaleTimeString('es-CL', options);
  };

  const getCountryCode = () => {
    // Obtener el código ISO 3166-1 del país basado en la zona horaria
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Mapeo de zonas horarias a códigos de país ISO 3166-1
    const timeZoneToCountry = {
      'America/Santiago': 'CL',
      'America/Argentina/Buenos_Aires': 'AR',
      'America/Argentina/Cordoba': 'AR',
      'America/Argentina/Salta': 'AR',
      'America/Argentina/Jujuy': 'AR',
      'America/Argentina/Tucuman': 'AR',
      'America/Argentina/Catamarca': 'AR',
      'America/Argentina/La_Rioja': 'AR',
      'America/Argentina/San_Juan': 'AR',
      'America/Argentina/Mendoza': 'AR',
      'America/Argentina/San_Luis': 'AR',
      'America/Argentina/Rio_Gallegos': 'AR',
      'America/Argentina/Ushuaia': 'AR',
      'America/Lima': 'PE',
      'America/Bogota': 'CO',
      'America/Caracas': 'VE',
      'America/Mexico_City': 'MX',
      'America/Montevideo': 'UY',
      'America/La_Paz': 'BO',
      'America/Asuncion': 'PY',
      'America/Guayaquil': 'EC',
      'America/Panama': 'PA',
      'America/Costa_Rica': 'CR',
      'America/Managua': 'NI',
      'America/Tegucigalpa': 'HN',
      'America/El_Salvador': 'SV',
      'America/Guatemala': 'GT',
      'America/Belize': 'BZ',
      'America/Santo_Domingo': 'DO',
      'America/Havana': 'CU',
      'America/Port-au-Prince': 'HT',
      'America/Sao_Paulo': 'BR',
      'America/Fortaleza': 'BR',
      'America/Manaus': 'BR',
      'America/Recife': 'BR',
      'Europe/Madrid': 'ES',
      'Europe/Lisbon': 'PT',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
    };

    return timeZoneToCountry[timeZone] || 'INT';
  };

  return (
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-slate-600" />
      <div className="flex items-baseline gap-2">
        <span 
          className="text-sm font-black text-slate-900" 
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {formatTime()}
        </span>
        <span className="text-xs font-bold text-slate-600">
          {getCountryCode()}
        </span>
      </div>
    </div>
  );
};

export default ServerClock;
