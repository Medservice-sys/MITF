import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { RefreshCw, Sliders, Calendar, Server, Loader2, Menu } from 'lucide-react';

const viewTitles = {
  dashboard: { title: 'Dashboard Principal', subtitle: 'Vista general del estado de salud del tomógrafo GE CT' },
  logs: { title: 'Explorador de Logs Consolidado', subtitle: 'Búsqueda avanzada y filtrado de eventos de telemetría' },
  history: { title: 'Historial Consolidado', subtitle: 'Agrupación temporal de eventos y alertas' },
  tsm: { title: 'Taxonomía de Mantenimiento TSM', subtitle: 'Catálogo de subsistemas y componentes físicos' },
  yang: { title: 'Árbol Data Model YANG', subtitle: 'Jerarquía del modelo de datos de telemetría' },
  hardware: { title: 'Desgaste de Hardware CT', subtitle: 'Métricas de tubo mAs, rotaciones de gantry y filamentos' },
  alerts: { title: 'Alertas Tempranas & Predictivas', subtitle: 'Eventos críticos y advertencias operativas' },
  dicom: { title: 'Red & Estaciones DICOM', subtitle: 'Pruebas C-ECHO y estado de colectores DICOM' },
  bitacora: { title: 'Bitácora &Tickets de Campo', subtitle: 'Asignación, gestión y resolución de fallas' },
  acknowledges: { title: 'Alertas Reconocidas (ACK)', subtitle: 'Registro de alarmas confirmadas y filtradas' },
  maintenance: { title: 'Calentamientos & Warm-up', subtitle: 'Control de rutinas de calentamiento de tubo' },
  stops: { title: 'Fallas Agrupadas & Abortos', subtitle: 'Monitoreo de interrupciones de escaneo' },
  'admin-classifications': { title: 'Clasificación de Alertas', subtitle: 'Administración de overrides y severidades de catálogo' },
  users: { title: 'Gestión de Usuarios & Roles', subtitle: 'Control de cuentas, roles y asignación de equipos' },
  ftp: { title: 'Ingesta de Archivos FTP', subtitle: 'Carga manual y monitoreo de watcher de archivos de log' },
  settings: { title: 'Ajustes del Sistema', subtitle: 'Configuración de ROI, intervalos de refresco y equipos SSH' },
};

export const Header = () => {
  const {
    activeView,
    selectedDevice,
    setSelectedDevice,
    dateRange,
    setDateRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    operationMode,
    toggleOperationMode,
    refreshInterval,
    timeLeft,
    refreshData,
    devicesList,
    isLoadingData,
    toggleSidebar,
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const viewMeta = viewTitles[activeView] || {
    title: 'MITF-TOM System',
    subtitle: 'Monitoreo de Tomógrafos GE CT',
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Calculate SVG strokeDashoffset for circular countdown timer
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = refreshInterval > 0 ? (timeLeft / refreshInterval) : 1;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <header className="glass-header">
      <div className="header-title-wrapper">
        <button
          className="mobile-menu-btn"
          onClick={toggleSidebar}
          title="Abrir Menú"
        >
          <Menu style={{ width: 22, height: 22 }} />
        </button>
        <div className="header-title">
          <h1>{viewMeta.title}</h1>
          <p className="subtitle">{viewMeta.subtitle}</p>
        </div>
      </div>

      <div className="header-controls">
        {/* Device selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          {isLoadingData ? (
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }}
              >
                Cargando...
              </span>
              <Loader2 style={{ width: 14, height: 14, color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <Server style={{ width: 14, height: 14, color: selectedDevice ? 'var(--primary)' : 'var(--text-dim)' }} />
          )}
          <select
            className="glass-input"
            style={{
              padding: '6px 28px 6px 10px',
              fontSize: '0.82rem',
              borderColor: isLoadingData ? 'var(--primary)' : selectedDevice ? 'rgba(0, 210, 255, 0.4)' : 'var(--glass-border)',
              boxShadow: isLoadingData ? '0 0 12px rgba(0, 210, 255, 0.35)' : 'none',
              transition: 'all 0.3s ease',
            }}
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <option value="">Todos los Equipos</option>
            {devicesList.map((dev) => (
              <option key={dev.id} value={dev.id}>
                {dev.name} ({dev.brand})
              </option>
            ))}
          </select>

        </div>

        {/* Date range selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar style={{ width: 14, height: 14, color: 'var(--text-dim)' }} />
          <select
            className="glass-input"
            style={{ padding: '6px 28px 6px 10px', fontSize: '0.82rem' }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="all">Todo el Histórico</option>
            <option value="today">Hoy</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Rango Personalizado</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="glass-input"
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>a</span>
            <input
              type="date"
              className="glass-input"
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}

        {/* Mode Toggle Button */}
        <button
          className="btn glass-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: '0.8rem',
            borderColor: operationMode === 'service' ? 'var(--warning)' : 'var(--glass-border)',
          }}
          onClick={toggleOperationMode}
          title="Cambiar Modo de Operación"
        >
          <Sliders style={{ width: 14, height: 14, color: operationMode === 'service' ? 'var(--warning)' : 'var(--primary)' }} />
          <span>{operationMode === 'service' ? 'Modo Servicio' : 'Modo En Línea'}</span>
        </button>

        {/* Manual Refresh & Circular Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="icon-btn"
            onClick={handleManualRefresh}
            title="Refrescar Datos"
            style={{ width: 34, height: 34 }}
          >
            <RefreshCw
              style={{
                width: 15,
                height: 15,
                transform: isRefreshing ? 'rotate(360deg)' : 'none',
                transition: 'transform 0.5s linear',
              }}
            />
          </button>

          <div
            title={`Refresco automático en ${timeLeft}s`}
            style={{
              position: 'relative',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="16"
                cy="16"
                r={radius}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="16"
                cy="16"
                r={radius}
                stroke="var(--primary)"
                strokeWidth="3"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-main)',
              }}
            >
              {timeLeft}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
