import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import TopBar from './TopBar';
import DailySidebar from '../DailySidebar';

const AppLayout = ({ children }) => {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F4F0' }}>
      <TopBar />
      
      {/* Floating Button for Daily Records */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed top-24 right-6 z-40 p-4 bg-gradient-to-r from-orange-500 to-red-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-110 transition-all shadow-lg"
        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        title="Registros del Día"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <main className="w-full">
        {children}
      </main>

      {/* Daily Sidebar */}
      {showSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            onClick={() => setShowSidebar(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-96 bg-white border-l-4 border-slate-900 z-50 overflow-y-auto shadow-2xl">
            <DailySidebar onClose={() => setShowSidebar(false)} />
          </div>
        </>
      )}
    </div>
  );
};

export default AppLayout;
