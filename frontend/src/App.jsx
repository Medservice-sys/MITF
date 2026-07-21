import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginOverlay } from './components/LoginOverlay';
import { HelpModal } from './components/HelpModal';
import { RoiModal } from './components/RoiModal';
import { ContextMenu } from './components/ContextMenu';
import { ToastContainer } from './components/ToastContainer';

import { DashboardView } from './views/DashboardView';
import { LogsExplorerView } from './views/LogsExplorerView';
import { HistoryView } from './views/HistoryView';
import { TsmView } from './views/TsmView';
import { YangView } from './views/YangView';
import { HardwareView } from './views/HardwareView';
import { AlertsView } from './views/AlertsView';
import { DicomView } from './views/DicomView';
import { BitacoraView } from './views/BitacoraView';
import { AcknowledgesView } from './views/AcknowledgesView';
import { MaintenanceView } from './views/MaintenanceView';
import { StopsView } from './views/StopsView';
import { AdminClassificationsView } from './views/AdminClassificationsView';
import { UsersView } from './views/UsersView';
import { FtpView } from './views/FtpView';
import { SettingsView } from './views/SettingsView';

const MainLayout = () => {
  const { activeView } = useApp();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'logs':
        return <LogsExplorerView />;
      case 'history':
        return <HistoryView />;
      case 'tsm':
        return <TsmView />;
      case 'yang':
        return <YangView />;
      case 'hardware':
        return <HardwareView />;
      case 'alerts':
        return <AlertsView />;
      case 'dicom':
        return <DicomView />;
      case 'bitacora':
        return <BitacoraView />;
      case 'acknowledges':
        return <AcknowledgesView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'stops':
        return <StopsView />;
      case 'admin-classifications':
        return <AdminClassificationsView />;
      case 'users':
        return <UsersView />;
      case 'ftp':
        return <FtpView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="view-content active">{renderView()}</div>
      </main>

      <LoginOverlay />
      <HelpModal />
      <RoiModal />
      <ContextMenu />
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppProvider>
        {/* Animated Background Blobs Container */}
        <div className="bg-blobs-container">
          <div className="blob blob-primary"></div>
          <div className="blob blob-secondary"></div>
          <div className="blob blob-accent"></div>
        </div>

        <MainLayout />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
