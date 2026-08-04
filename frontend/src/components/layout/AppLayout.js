import React from 'react';
import TopBar from './TopBar';

const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F4F0' }}>
      <TopBar />
      <main className="w-full">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
