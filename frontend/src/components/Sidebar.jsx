import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  LayoutDashboard,
  FileText,
  Boxes,
  GitFork,
  HardDrive,
  Bell,
  Radio,
  BookOpen,
  CheckCircle2,
  Thermometer,
  AlertOctagon,
  ShieldCheck,
  Users,
  UploadCloud,
  Settings,
  LogOut,
  History,
  X,
} from 'lucide-react';

export const Sidebar = () => {
  const { activeView, setActiveView, isBackendOnline, isSidebarOpen, closeSidebar } = useApp();
  const { userRole, userFullName, logout } = useAuth();

  const handleNavClick = (viewId) => {
    setActiveView(viewId);
    closeSidebar();
  };

  const roleLabel =
    userRole === 'admin'
      ? 'Administrador'
      : userRole === 'engineer'
      ? 'Ing. Campo'
      : 'Operario';

  return (
    <>
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />
      <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
        <div className="logo-area" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity className="icon-primary" style={{ width: 28, height: 28 }} />
            <div>
              <h2>MITF-TOM</h2>
              <span className="logo-version">v1.2 React</span>
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={closeSidebar}
            title="Cerrar menú"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

      <nav className="nav-menu">
        <div className="nav-category">GENERAL</div>
        <button
          className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNavClick('dashboard')}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-item ${activeView === 'logs' ? 'active' : ''}`}
          onClick={() => handleNavClick('logs')}
        >
          <FileText />
          <span>Explorador de Logs</span>
        </button>

        <button
          className={`nav-item ${activeView === 'history' ? 'active' : ''}`}
          onClick={() => handleNavClick('history')}
        >
          <History />
          <span>Historial Consolidado</span>
        </button>

        <button
          className={`nav-item ${activeView === 'tsm' ? 'active' : ''}`}
          onClick={() => handleNavClick('tsm')}
        >
          <Boxes />
          <span>Taxonomía TSM</span>
        </button>

        <button
          className={`nav-item ${activeView === 'yang' ? 'active' : ''}`}
          onClick={() => handleNavClick('yang')}
        >
          <GitFork />
          <span>Árbol YANG</span>
        </button>

        <div className="nav-category">DIAGNÓSTICO</div>
        <button
          className={`nav-item ${activeView === 'hardware' ? 'active' : ''}`}
          onClick={() => handleNavClick('hardware')}
        >
          <HardDrive />
          <span>Hardware CT</span>
        </button>

        <button
          className={`nav-item ${activeView === 'alerts' ? 'active' : ''}`}
          onClick={() => handleNavClick('alerts')}
        >
          <Bell />
          <span>Alertas Tempranas</span>
        </button>

        <button
          className={`nav-item ${activeView === 'dicom' ? 'active' : ''}`}
          onClick={() => handleNavClick('dicom')}
        >
          <Radio />
          <span>DICOM / Red</span>
        </button>

        <div className="nav-category">OPERATIVA</div>
        <button
          className={`nav-item ${activeView === 'bitacora' ? 'active' : ''}`}
          onClick={() => handleNavClick('bitacora')}
        >
          <BookOpen />
          <span>Bitácora de Campo</span>
        </button>

        <button
          className={`nav-item ${activeView === 'acknowledges' ? 'active' : ''}`}
          onClick={() => handleNavClick('acknowledges')}
        >
          <CheckCircle2 />
          <span>Reconocidas (ACK)</span>
        </button>

        <button
          className={`nav-item ${activeView === 'maintenance' ? 'active' : ''}`}
          onClick={() => handleNavClick('maintenance')}
        >
          <Thermometer />
          <span>Calentamientos</span>
        </button>

        <button
          className={`nav-item ${activeView === 'stops' ? 'active' : ''}`}
          onClick={() => handleNavClick('stops')}
        >
          <AlertOctagon />
          <span>Fallas Agrupadas</span>
        </button>

        {userRole === 'admin' && (
          <>
            <div className="nav-category">ADMINISTRACIÓN</div>
            <button
              className={`nav-item ${activeView === 'admin-classifications' ? 'active' : ''}`}
              onClick={() => handleNavClick('admin-classifications')}
            >
              <ShieldCheck />
              <span>Clasificación Alertas</span>
            </button>

            <button
              className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => handleNavClick('users')}
            >
              <Users />
              <span>Gestión Usuarios</span>
            </button>

            <button
              className={`nav-item ${activeView === 'ftp' ? 'active' : ''}`}
              onClick={() => handleNavClick('ftp')}
            >
              <UploadCloud />
              <span>Ingesta FTP</span>
            </button>

            <button
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => handleNavClick('settings')}
            >
              <Settings />
              <span>Ajustes</span>
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="user-avatar">{userFullName.charAt(0).toUpperCase() || 'U'}</div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {userFullName || 'Usuario'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>{roleLabel}</div>
            </div>
          </div>

          <button
            className="icon-btn"
            onClick={logout}
            title="Cerrar Sesión"
            style={{ width: 32, height: 32, color: 'var(--critical)' }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className="status-indicator">
          <div className={`dot ${isBackendOnline ? 'dot-green' : 'dot-red'}`}></div>
          <span>{isBackendOnline ? 'Sistema En Línea' : 'Servidor Desconectado'}</span>
        </div>
      </div>
    </aside>
    </>
  );
};
