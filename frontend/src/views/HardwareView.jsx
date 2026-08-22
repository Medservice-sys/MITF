import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { HardDrive, Save, HelpCircle, Ticket, Activity } from 'lucide-react';

import { HardwareMriView } from './HardwareMriView';

export const HardwareView = () => {
  const { selectedModality, allEvents, latestMetrics, refreshData, showToast, setHelpCode, setContextMenu } = useApp();

  if (selectedModality === 'MRI') {
    return <HardwareMriView />;
  }
  const { userRole } = useAuth();

  const [tubeModels, setTubeModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [masCapacity, setMasCapacity] = useState(100000000);
  const [maxThermal, setMaxThermal] = useState(300);
  const [kThermal, setKThermal] = useState(0.05);
  const [maxRevs, setMaxRevs] = useState(() => parseInt(localStorage.getItem('max-revs-limit')) || 100000);

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch health config & tube taxonomy
  useEffect(() => {
    fetch('/api/admin/tube-models')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data.tube_models) setTubeModels(data.tube_models);
      })
      .catch((err) => console.error(err));

    fetch('/api/admin/health-config')
      .then((res) => (res.ok ? res.json() : {}))
      .then((cfg) => {
        if (cfg.rated_mas_capacity) setMasCapacity(cfg.rated_mas_capacity);
        if (cfg.n_max_thermal) setMaxThermal(cfg.n_max_thermal);
        if (cfg.k_thermal) setKThermal(cfg.k_thermal);
        if (cfg.selected_tube_model) setSelectedModel(cfg.selected_tube_model);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleModelChange = (modelName) => {
    setSelectedModel(modelName);
    if (modelName === 'auto') return;
    const model = tubeModels.find((m) => m.model === modelName);
    if (model) {
      setMasCapacity(model.eol_mas_min);
      setMaxThermal(Math.round(model.anode_heat_capacity_mhu * 47.6));
    }
  };

  const handleAdminFormSubmit = async (e) => {
    e.preventDefault();
    localStorage.setItem('max-revs-limit', maxRevs);

    try {
      const getRes = await fetch('/api/admin/health-config');
      const currentCfg = getRes.ok ? await getRes.json() : {};

      currentCfg.rated_mas_capacity = Number(masCapacity);
      currentCfg.n_max_thermal = Number(maxThermal);
      currentCfg.k_thermal = Number(kThermal);
      currentCfg.selected_tube_model = selectedModel;

      const postRes = await fetch('/api/admin/health-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentCfg),
      });

      if (postRes.ok) {
        showToast('Parámetros de desgaste de tubo guardados correctamente', 'success');
        refreshData();
      } else {
        showToast('Error al guardar configuración', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar', 'error');
    }
  };

  // Compute mAs accumulation from allEvents
  const cumulativeMas = useMemo(() => {
    let mas = 7478990; // default baseline
    allEvents.forEach((ev) => {
      const msg = ev.message || '';
      if (ev.subsystem === 'tube' || msg.toLowerCase().includes('mas')) {
        const match = msg.match(/([\d,]+)\s*mAs/i);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(val) && val > mas) mas = val;
        }
      }
    });
    return mas;
  }, [allEvents]);

  const masPercent = Math.min(100, (cumulativeMas / masCapacity) * 100);
  const revsCount = 45210; // baseline
  const revsPercent = Math.min(100, (revsCount / maxRevs) * 100);

  // Hardware events filter
  const hardwareEvents = useMemo(() => {
    let list = allEvents.filter(
      (e) =>
        ['tube', 'gantry', 'cooling', 'ips', 'das'].includes((e.subsystem || '').toLowerCase()) ||
        (e.message || '').toLowerCase().includes('mas') ||
        (e.message || '').toLowerCase().includes('thermal') ||
        (e.message || '').toLowerCase().includes('rotor')
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) => (e.message || '').toLowerCase().includes(q) || (e.subsystem || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [allEvents, searchQuery]);

  return (
    <div className="hardware-view">
      {/* Hardware metrics cards */}
      <div className="health-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="health-card glass-panel">
          <div className="health-label">Acumulación de mAs del Tubo RX</div>
          <div className="health-value-wrapper">
            <h2 style={{ color: 'var(--primary)' }}>{cumulativeMas.toLocaleString()} mAs</h2>
          </div>
          <div className="health-sub">Límite Nominal EOL: {masCapacity.toLocaleString()} mAs ({masPercent.toFixed(1)}%)</div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{
                width: `${masPercent}%`,
                background: masPercent > 80 ? 'var(--critical)' : masPercent > 60 ? 'var(--warning)' : 'var(--primary)',
              }}
            ></div>
          </div>
        </div>

        <div className="health-card glass-panel">
          <div className="health-label">Rotaciones del Gantry (Rotor)</div>
          <div className="health-value-wrapper">
            <h2 style={{ color: 'var(--secondary)' }}>{revsCount.toLocaleString()} Revs</h2>
          </div>
          <div className="health-sub">Límite Recomendado: {maxRevs.toLocaleString()} Revs ({revsPercent.toFixed(1)}%)</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${revsPercent}%`, background: 'var(--secondary)' }}></div>
          </div>
        </div>

        <div className="health-card glass-panel">
          <div className="health-label">Temperatura Filamento / Ánodo</div>
          <div className="health-value-wrapper">
            <h2 style={{ color: 'var(--warning)' }}>1,850 °C / Normal</h2>
          </div>
          <div className="health-sub">Capacidad Térmica Ánodo: {maxThermal} MHU</div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: '14.2%', background: 'var(--warning)' }}></div>
          </div>
        </div>
      </div>

      {/* Admin Tube settings configuration form */}
      {userRole === 'admin' && (
        <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
          <div className="table-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardDrive style={{ width: 22, height: 22, color: 'var(--primary)' }} />
              <h3>Parámetros de Desgaste & Modelo de Tubo RX (Administrador)</h3>
            </div>
          </div>

          <form onSubmit={handleAdminFormSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Modelo del Tubo RX
              </label>
              <select
                className="glass-input"
                style={{ width: '100%' }}
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                <option value="auto">Selección Manual / Personalizado</option>
                {tubeModels.map((m) => (
                  <option key={m.model} value={m.model}>
                    {m.model} ({m.anode_heat_capacity_mhu} MHU)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Capacidad mAs EOL (Tubo)
              </label>
              <input
                type="number"
                className="glass-input"
                style={{ width: '100%' }}
                value={masCapacity}
                onChange={(e) => setMasCapacity(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Capacidad Térmica Máx Ánodo (MHU)
              </label>
              <input
                type="number"
                className="glass-input"
                style={{ width: '100%' }}
                value={maxThermal}
                onChange={(e) => setMaxThermal(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Coeficiente Térmico (k_thermal)
              </label>
              <input
                type="number"
                step="0.01"
                className="glass-input"
                style={{ width: '100%' }}
                value={kThermal}
                onChange={(e) => setKThermal(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Límite Rotaciones Gantry
              </label>
              <input
                type="number"
                className="glass-input"
                style={{ width: '100%' }}
                value={maxRevs}
                onChange={(e) => setMaxRevs(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                className="btn"
                style={{
                  width: '100%',
                  background: 'var(--primary)',
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Save style={{ width: 16, height: 16 }} />
                <span>Guardar Parámetros</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hardware Telemetry Table */}
      <div className="table-box glass-panel">
        <div className="table-header">
          <h3>Eventos Telemétricos de Componentes de Hardware</h3>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Subsistema</th>
                <th>Código</th>
                <th>Severidad</th>
                <th>Detalle del Componente</th>
                <th style={{ textAlign: 'center' }}>Ayuda</th>
              </tr>
            </thead>
            <tbody>
              {hardwareEvents.length > 0 ? (
                hardwareEvents.map((ev, idx) => (
                  <tr
                    key={ev.id || idx}
                    onContextMenu={(e) =>
                      setContextMenu({
                        x: e.pageX,
                        y: e.pageY,
                        eventData: ev,
                      })
                    }
                  >
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {(ev.subsystem || 'TUBE').toUpperCase()}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {ev.tceCode || ev.process || 'MITF-HW'}
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          ev.severity === 'CRITICAL' || ev.severity === 'SEVERE_ERROR'
                            ? 'pill-critical'
                            : ev.severity === 'WARNING' || ev.severity === 'MAJOR_ERROR'
                            ? 'pill-warning'
                            : 'pill-info'
                        }`}
                      >
                        {ev.severity || 'INFO'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{ev.message}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn glass-btn"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => setHelpCode(ev.tceCode || 'GE-HW-01')}
                      >
                        <HelpCircle style={{ width: 12, height: 12 }} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No hay eventos de hardware registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
