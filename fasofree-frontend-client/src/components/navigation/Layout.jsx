import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import PWAInstallButton from '../../components/PWAInstallButton';

const Layout = () => {
  return (
    <div className="min-h-screen bg-background-primary">
      <div className="fixed top-3 right-3 z-40 hidden sm:block">
        <PWAInstallButton className="shadow-sm" />
      </div>
      <main className="pb-20 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
