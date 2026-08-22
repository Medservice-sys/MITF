import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operationMode, setOperationMode] = useState('online');
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  const [isLoadingData, setIsLoadingData] = useState(false);

  const [selectedModality, setSelectedModalityState] = useState(() => localStorage.getItem('mitf-selected-modality') || 'CT');
  const [mriMetrics, setMriMetrics] = useState(null);

  const setSelectedModality = (mod) => {
    setSelectedModalityState(mod);
    localStorage.setItem('mitf-selected-modality', mod);
  };

  // Data states
  const [latestMetrics, setLatestMetrics] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [devicesList, setDevicesList] = useState([]);

  // Sidebar mobile toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Modals & UI states
  const [helpCode, setHelpCode] = useState(null);
  const [showRoiModal, setShowRoiModal] = useState(false);
  const [deviceModalData, setDeviceModalData] = useState(null); // null = closed, object = edit/create
  const [userModalData, setUserModalData] = useState(null);     // null = closed, object = edit/create
  const [toasts, setToasts] = useState([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, event }

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch metrics & config
  const refreshData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Fetch system config
      const cfgRes = await fetch('/api/config');
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        if (cfg.operationMode) setOperationMode(cfg.operationMode);
        if (cfg.refreshInterval) setRefreshInterval(cfg.refreshInterval);
        if (cfg.devices) setDevicesList(cfg.devices);
      }

      // 2. Query params
      const params = new URLSearchParams();
      if (selectedDevice) params.append('deviceId', selectedDevice);
      if (dateRange && dateRange !== 'all') params.append('range', dateRange);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedModality) params.append('modality', selectedModality);

      const queryString = params.toString() ? `?${params.toString()}` : '';

      // 3. Fetch metrics (CT & general)
      const metricsRes = await fetch(`/api/metrics${queryString}`);
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        setLatestMetrics(metrics);
        setIsBackendOnline(true);
      } else {
        setIsBackendOnline(false);
      }

      // 4. Fetch MRI metrics
      try {
        const mriRes = await fetch('/api/mri/metrics');
        if (mriRes.ok) {
          const mriData = await mriRes.json();
          setMriMetrics(mriData);
        }
      } catch (e) {
        console.error("MRI Metrics fetch error:", e);
      }

      // 5. Fetch telemetry log events
      const eventsRes = await fetch(`/api/data${queryString}`);
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        setAllEvents(events);
      }
    } catch (err) {
      console.error('Failed to refresh app data:', err);
      setIsBackendOnline(false);
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedDevice, dateRange, startDate, endDate, selectedModality]);

  // Interval timer for countdown & refresh
  useEffect(() => {
    refreshData();
    setTimeLeft(refreshInterval);
  }, [refreshData, refreshInterval]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          refreshData();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, refreshData]);

  const toggleOperationMode = async () => {
    const newMode = operationMode === 'online' ? 'service' : 'online';
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationMode: newMode }),
      });
      if (res.ok) {
        setOperationMode(newMode);
        showToast(`Modo cambiado a: ${newMode === 'online' ? 'En Línea' : 'Servicio (Multimarca)'}`, 'success');
        refreshData();
      } else {
        showToast('Error al cambiar el modo de operación', 'error');
      }
    } catch (err) {
      console.error('Mode toggle failed:', err);
      showToast('Error de conexión al cambiar modo', 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
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
        setRefreshInterval,
        timeLeft,
        isBackendOnline,
        isLoadingData,
        selectedModality,
        setSelectedModality,
        mriMetrics,
        latestMetrics,
        allEvents,
        devicesList,
        refreshData,
        toasts,
        showToast,
        helpCode,
        setHelpCode,
        showRoiModal,
        setShowRoiModal,
        deviceModalData,
        setDeviceModalData,
        userModalData,
        setUserModalData,
        contextMenu,
        setContextMenu,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        closeSidebar,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
