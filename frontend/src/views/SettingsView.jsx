import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Save, Server, Plus, Edit, Trash2, Sliders, DollarSign, Activity, Loader2 } from 'lucide-react';
import { DeviceModal } from '../components/DeviceModal';

export const SettingsView = () => {
  const {
    refreshInterval,
    setRefreshInterval,
    operationMode,
    toggleOperationMode,
    devicesList,
    setDeviceModalData,
    showToast,
    refreshData,
  } = useApp();

  const [pingingId, setPingingId] = useState(null);

  // ROI prices
  const [avoidedCritical, setAvoidedCritical] = useState(15000);
  const [avoidedMajor, setAvoidedMajor] = useState(8000);
  const [avoidedWarning, setAvoidedWarning] = useState(3000);
  const [intervField, setIntervField] = useState(2000);
  const [intervRemote, setIntervRemote] = useState(500);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : {}))
      .then((cfg) => {
        if (cfg.avoidedCosts) {
          if (cfg.avoidedCosts.critical !== undefined) setAvoidedCritical(cfg.avoidedCosts.critical);
          if (cfg.avoidedCosts.major !== undefined) setAvoidedMajor(cfg.avoidedCosts.major);
          if (cfg.avoidedCosts.warning !== undefined) setAvoidedWarning(cfg.avoidedCosts.warning);
        }
        if (cfg.interventionCosts) {
          if (cfg.interventionCosts.field !== undefined) setIntervField(cfg.interventionCosts.field);
          if (cfg.interventionCosts.remote !== undefined) setIntervRemote(cfg.interventionCosts.remote);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSaveRoiConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avoidedCosts: {
            critical: Number(avoidedCritical),
            major: Number(avoidedMajor),
            warning: Number(avoidedWarning),
          },
          interventionCosts: {
            field: Number(intervField),
            remote: Number(intervRemote),
          },
        }),
      });

      if (res.ok) {
        showToast('Parámetros de ROI financiero guardados correctamente', 'success');
        refreshData();
      } else {
        showToast('Error al guardar configuración ROI', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  const handleDeleteDevice = async (devId, devName) => {
    if (!window.confirm(`¿Está seguro de eliminar el equipo '${devName}'?`)) return;

    const updated = devicesList.filter((d) => d.id !== devId);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationMode,
          refreshInterval,
          devices: updated,
        }),
      });

      if (res.ok) {
        showToast(`Equipo ${devName} eliminado`, 'success');
        refreshData();
      } else {
        showToast('Error al eliminar equipo', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  const handlePingDevice = async (dev) => {
    setPingingId(dev.id);
    try {
      const res = await fetch('/api/devices/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dev),
      });

      const data = await res.json();
      if (data.status === 'online') {
        showToast(`Conexión SSH exitosa a ${dev.name} (${data.latency})`, 'success');
      } else if (data.status === 'degraded') {
        showToast(`Red alcanzable (${data.latency}), error SSH: ${data.error}`, 'warning');
      } else {
        showToast(`Sin conexión a ${dev.name}: ${data.error || 'Offline'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al probar conexión con el equipo', 'error');
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div className="settings-view">
      {/* General & Telemetry settings */}
      <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Sliders style={{ width: 22, height: 22, color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Ajustes de Telemetría & Modo de Operación</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 6, display: 'block' }}>
              Modo de Operación del Colector
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                className="btn"
                style={{
                  flex: 1,
                  background: operationMode === 'online' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: operationMode === 'online' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                }}
                onClick={toggleOperationMode}
              >
                Modo En Línea (GE Native)
              </button>

              <button
                className="btn"
                style={{
                  flex: 1,
                  background: operationMode === 'service' ? 'var(--warning)' : 'rgba(255,255,255,0.05)',
                  color: operationMode === 'service' ? '#000' : 'var(--text-main)',
                  fontWeight: 600,
                }}
                onClick={toggleOperationMode}
              >
                Modo Servicio (Multimarca)
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 6, display: 'block' }}>
              Intervalo de Refresco Automático (Segundos)
            </label>
            <select
              className="glass-input"
              style={{ width: '100%' }}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={5}>Cada 5 segundos (Alta frecuencia)</option>
              <option value={15}>Cada 15 segundos (Estándar)</option>
              <option value={30}>Cada 30 segundos</option>
              <option value={60}>Cada 60 segundos (Bajo tráfico)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial ROI Parameters Form */}
      <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <DollarSign style={{ width: 22, height: 22, color: 'var(--secondary)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Parámetros de Evaluación ROI Financiero</h3>
        </div>

        <form onSubmit={handleSaveRoiConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Costo Evitado por Falla Crítica (Bs)
            </label>
            <input
              type="number"
              className="glass-input"
              style={{ width: '100%' }}
              value={avoidedCritical}
              onChange={(e) => setAvoidedCritical(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Costo Evitado por Falla Mayor (Bs)
            </label>
            <input
              type="number"
              className="glass-input"
              style={{ width: '100%' }}
              value={avoidedMajor}
              onChange={(e) => setAvoidedMajor(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Costo Evitado por Advertencia (Bs)
            </label>
            <input
              type="number"
              className="glass-input"
              style={{ width: '100%' }}
              value={avoidedWarning}
              onChange={(e) => setAvoidedWarning(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Costo Intervención En Sitio (Bs)
            </label>
            <input
              type="number"
              className="glass-input"
              style={{ width: '100%' }}
              value={intervField}
              onChange={(e) => setIntervField(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Costo Intervención Remota (Bs)
            </label>
            <input
              type="number"
              className="glass-input"
              style={{ width: '100%' }}
              value={intervRemote}
              onChange={(e) => setIntervRemote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              className="btn"
              style={{ width: '100%', background: 'var(--secondary)', color: '#000', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Save style={{ width: 16, height: 16 }} />
              <span>Guardar Precios ROI</span>
            </button>
          </div>
        </form>
      </div>

      {/* Target SSH Equipment List */}
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Equipos Tomógrafos Monitoreados por SSH ({devicesList.length})</h3>
          </div>

          <button
            className="btn"
            style={{ background: 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setDeviceModalData({})}
          >
            <Plus style={{ width: 14, height: 14 }} />
            <span>Añadir Equipo SSH</span>
          </button>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Nombre Equipo</th>
                <th>Marca</th>
                <th>Host / IP</th>
                <th>Usuario SSH</th>
                <th>Directorio Log</th>
                <th>Monitoreo</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {devicesList.length > 0 ? (
                devicesList.map((dev) => (
                  <tr key={dev.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{dev.name}</td>
                    <td>{dev.brand}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)' }}>
                      {dev.host}:{dev.port || 22}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{dev.user}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {dev.remoteLogDir}
                    </td>
                    <td>
                      <span className={`pill ${dev.active !== false ? 'pill-success' : 'pill-warning'}`}>
                        {dev.active !== false ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          className="btn glass-btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--primary)' }}
                          onClick={() => handlePingDevice(dev)}
                          disabled={pingingId === dev.id}
                          title="Probar Conexión (Ping SSH)"
                        >
                          {pingingId === dev.id ? (
                            <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Activity style={{ width: 12, height: 12 }} />
                          )}
                        </button>
                        <button
                          className="btn glass-btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setDeviceModalData(dev)}
                          title="Editar Equipo"
                        >
                          <Edit style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          className="btn glass-btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--critical)' }}
                          onClick={() => handleDeleteDevice(dev.id, dev.name)}
                          title="Eliminar Equipo"
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No hay equipos tomógrafos configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeviceModal />
    </div>
  );
};
