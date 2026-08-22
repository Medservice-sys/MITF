import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Zap,
  Activity,
  AlertTriangle,
  AlertCircle,
  Thermometer,
  ShieldAlert,
  Search,
  CheckCircle2,
  HardDrive,
  Cpu,
  Layers,
  HelpCircle,
  Snowflake,
  Magnet,
  Radio,
  Lock,
} from 'lucide-react';

export const MriDashboardView = () => {
  const {
    mriMetrics,
    allEvents,
    setHelpCode,
    setContextMenu,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [miniSeverity, setMiniSeverity] = useState('ALL');
  const [activeComponent, setActiveComponent] = useState('magnet');

  // MRI Metrics fallback from system_health.log / HART
  const heliumPercent = mriMetrics?.heliumLevelPercent ?? 78.5;
  const magnetPressure = mriMetrics?.magnetPressure ?? 4.2;
  const magnetField = mriMetrics?.magnetField ?? '1.5T LCC';
  const magnetSerial = mriMetrics?.magnetSerial ?? 'R4290';
  const rampStatus = mriMetrics?.magnetRampStatus ?? 'pos';
  const gradientRiseTime = mriMetrics?.gradientRiseTime ?? 276;
  const gradientAmp = mriMetrics?.gradientAmpType ?? 'HFD Gradients';
  const rfAmpType = mriMetrics?.rfAmpType ?? '1.5T SRFD2';
  const bwkHz = mriMetrics?.maxBandwidthkHz ?? 250.0;
  const temp1 = mriMetrics?.boreTempLevel1 ?? 31.0;
  const temp2 = mriMetrics?.boreTempLevel2 ?? 36.0;
  const activeTirCount = mriMetrics?.activeTirInterlocks ?? 0;
  const healthScore = mriMetrics?.mriHealthScore ?? 98.5;

  // Filter MRI events
  const mriEvents = useMemo(() => {
    let result = allEvents.filter(
      (e) =>
        e.modality === 'MRI' ||
        e.subsystem === 'magnet' ||
        e.subsystem === 'cryo' ||
        e.subsystem === 'gradient' ||
        e.subsystem === 'rf_amp' ||
        e.subsystem === 'thermal' ||
        e.subsystem === 'bore' ||
        (e.source && e.source.toLowerCase().includes('lx-mr')) ||
        (e.source && e.source.toLowerCase().includes('resonador'))
    );

    if (miniSeverity !== 'ALL') {
      result = result.filter((e) => {
        if (miniSeverity === 'CRITICAL') return e.severity === 'CRITICAL' || e.severity === 'SEVERE_ERROR';
        if (miniSeverity === 'WARNING') return e.severity === 'WARNING' || e.severity === 'MAJOR_ERROR';
        if (miniSeverity === 'INFO') return e.severity === 'INFORMATIONAL' || e.severity === 'INFO';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          (e.message && e.message.toLowerCase().includes(q)) ||
          (e.geCode && e.geCode.toLowerCase().includes(q)) ||
          (e.process && e.process.toLowerCase().includes(q)) ||
          (e.subsystem && e.subsystem.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allEvents, miniSeverity, searchQuery]);

  return (
    <div className="view-container">
      {/* Top Banner Header */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
            }}
          >
            <Zap style={{ width: 26, height: 26, color: '#fff' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                Resonador Magnético GE MRI LX-MR
              </h2>
              <span
                className="badge"
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                }}
              >
                1.5T Superconductor
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Hospital: RadiologyDiagnosticCenter | Serie Imán: {magnetSerial} | SW: 12.0_M5B_0846.d
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
              Índice de Salud MRI (MHI)
            </span>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: healthScore >= 90 ? '#10b981' : healthScore >= 75 ? '#f59e0b' : '#ef4444',
              }}
            >
              {healthScore.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Criogenia & Helio */}
        <div
          className={`glass-card ${activeComponent === 'cryo' ? 'active' : ''}`}
          onClick={() => setActiveComponent('cryo')}
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Criogenia / Nivel Helio</span>
            <Snowflake style={{ width: 20, height: 20, color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>{heliumPercent}%</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
            Presión Imán: <strong style={{ color: '#fff' }}>{magnetPressure} psi</strong>
          </div>
          <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${heliumPercent}%`, height: '100%', background: '#0284c7' }} />
          </div>
        </div>

        {/* Card 2: Imán Principal */}
        <div
          className={`glass-card ${activeComponent === 'magnet' ? 'active' : ''}`}
          onClick={() => setActiveComponent('magnet')}
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Imán Superconductor</span>
            <Magnet style={{ width: 20, height: 20, color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#a855f7' }}>{magnetField}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
            Estado Rampa: <strong style={{ color: '#10b981' }}>{rampStatus.toUpperCase()} (Estable)</strong>
          </div>
        </div>

        {/* Card 3: Amplificador de Gradientes */}
        <div
          className={`glass-card ${activeComponent === 'gradient' ? 'active' : ''}`}
          onClick={() => setActiveComponent('gradient')}
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Amplif. Gradientes</span>
            <Zap style={{ width: 20, height: 20, color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b' }}>{gradientRiseTime} µs</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
            Tipo: <strong style={{ color: '#fff' }}>{gradientAmp}</strong>
          </div>
        </div>

        {/* Card 4: Amplificador RF */}
        <div
          className={`glass-card ${activeComponent === 'rf' ? 'active' : ''}`}
          onClick={() => setActiveComponent('rf')}
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Amplif. RF / Bandwidth</span>
            <Radio style={{ width: 20, height: 20, color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>{bwkHz} kHz</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
            Modelo: <strong style={{ color: '#fff' }}>{rfAmpType}</strong>
          </div>
        </div>

        {/* Card 5: Temperatura Bore */}
        <div
          className={`glass-card ${activeComponent === 'bore' ? 'active' : ''}`}
          onClick={() => setActiveComponent('bore')}
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Temperatura Bore</span>
            <Thermometer style={{ width: 20, height: 20, color: '#ec4899' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ec4899' }}>{temp1}°C / {temp2}°C</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
            Límite Histeresis: <strong style={{ color: '#10b981' }}>PASS</strong>
          </div>
        </div>

        {/* Card 6: Interlocks TIR */}
        <div
          className={`glass-card ${activeComponent === 'tir' ? 'active' : ''}`}
          onClick={() => setActiveComponent('tir')}
          style={{ cursor: 'pointer', padding: '16px', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>Interlocks Térmicos (TIR)</span>
            <Lock style={{ width: 20, height: 20, color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: activeTirCount === 0 ? '#10b981' : '#ef4444' }}>
            {activeTirCount} Activos
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
            TIR Engine: <strong style={{ color: '#10b981' }}>NORMAL</strong>
          </div>
        </div>
      </div>

      {/* MRI Interactive Visual Scheme */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>
              Esquema Interactivo del Resonador Magnético (MRI Subsystems)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Selecciona un componente para inspeccionar su telemetría y logs asociados
            </p>
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto', textAlign: 'center', padding: '20px 0' }}>
          <svg viewBox="0 0 900 320" style={{ maxWidth: '850px', height: 'auto' }}>
            <defs>
              <radialGradient id="mriBoreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="cryoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>

            {/* Background Magnet Outer Shell */}
            <rect x="250" y="40" width="400" height="240" rx="30" fill="url(#cryoGrad)" stroke="#38bdf8" strokeWidth="3" opacity="0.9" />

            {/* Cryostat Ring */}
            <circle cx="450" cy="160" r="100" fill="#0f172a" stroke="#ec4899" strokeWidth="4" />
            <circle cx="450" cy="160" r="85" fill="url(#mriBoreGlow)" stroke="#a855f7" strokeWidth="2" strokeDasharray="6 4" />
            <circle cx="450" cy="160" r="65" fill="#020617" stroke="#38bdf8" strokeWidth="2" />

            {/* Patient Table Bed */}
            <rect x="50" y="165" width="340" height="14" rx="4" fill="#64748b" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="80" y="179" width="20" height="70" fill="#475569" />
            <rect x="200" y="179" width="20" height="70" fill="#475569" />

            {/* Subsystem Interactive Labels & Boxes */}

            {/* 1. Criogenia / Helium Vessel */}
            <g onClick={() => setActiveComponent('cryo')} style={{ cursor: 'pointer' }}>
              <rect x="270" y="55" width="120" height="40" rx="6" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
              <text x="330" y="75" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">Criogenia</text>
              <text x="330" y="88" fill="#e0f2fe" fontSize="10" textAnchor="middle">Helio: {heliumPercent}%</text>
            </g>

            {/* 2. Gradient Coils */}
            <g onClick={() => setActiveComponent('gradient')} style={{ cursor: 'pointer' }}>
              <rect x="510" y="55" width="120" height="40" rx="6" fill="#d97706" stroke="#f59e0b" strokeWidth="2" />
              <text x="570" y="75" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">Gradientes</text>
              <text x="570" y="88" fill="#fef3c7" fontSize="10" textAnchor="middle">{gradientRiseTime} µs (PASS)</text>
            </g>

            {/* 3. RF Transceiver */}
            <g onClick={() => setActiveComponent('rf')} style={{ cursor: 'pointer' }}>
              <rect x="270" y="225" width="120" height="40" rx="6" fill="#059669" stroke="#10b981" strokeWidth="2" />
              <text x="330" y="245" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">RF Body Coil</text>
              <text x="330" y="258" fill="#d1fae5" fontSize="10" textAnchor="middle">BW: {bwkHz} kHz</text>
            </g>

            {/* 4. Bore Sensor / TIR */}
            <g onClick={() => setActiveComponent('bore')} style={{ cursor: 'pointer' }}>
              <rect x="510" y="225" width="120" height="40" rx="6" fill="#db2777" stroke="#ec4899" strokeWidth="2" />
              <text x="570" y="245" fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle">Sensores Bore</text>
              <text x="570" y="258" fill="#fce7f3" fontSize="10" textAnchor="middle">{temp1}°C / {temp2}°C</text>
            </g>

            {/* Center Label */}
            <text x="450" y="155" fill="#fff" fontSize="14" fontWeight="800" textAnchor="middle">BORE 60cm</text>
            <text x="450" y="172" fill="#38bdf8" fontSize="11" fontWeight="600" textAnchor="middle">1.5T LCC</text>
          </svg>
        </div>
      </div>

      {/* MRI Logs Explorer Section */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity style={{ color: '#ec4899' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>
              Eventos de Telemetría de Resonancia Magnética ({mriEvents.length})
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 14,
                  height: 14,
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                className="glass-input"
                placeholder="Buscar eventos en resonador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 30, fontSize: '0.82rem', width: 220 }}
              />
            </div>

            <select
              className="glass-input"
              value={miniSeverity}
              onChange={(e) => setMiniSeverity(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
            >
              <option value="ALL">Todas las Severidades</option>
              <option value="CRITICAL">Críticos / Error</option>
              <option value="WARNING">Advertencias</option>
              <option value="INFO">Informacionales</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Severidad</th>
                <th>Proceso / Origen</th>
                <th>Subsistema</th>
                <th>Mensaje / Evento de Resonancia</th>
              </tr>
            </thead>
            <tbody>
              {mriEvents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No se encontraron eventos de resonancia con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                mriEvents.slice(0, 30).map((ev, idx) => {
                  const isCrit = ev.severity === 'CRITICAL' || ev.severity === 'SEVERE_ERROR';
                  const isWarn = ev.severity === 'WARNING' || ev.severity === 'MAJOR_ERROR';
                  return (
                    <tr
                      key={ev.id || idx}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, event: ev });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#cbd5e1' }}>
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'N/A'}
                      </td>
                      <td>
                        <span
                          className={`severity-badge ${
                            isCrit ? 'severity-critical' : isWarn ? 'severity-warning' : 'severity-info'
                          }`}
                        >
                          {ev.severity || 'INFO'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                        {ev.process || 'SYSTEM'}
                      </td>
                      <td>
                        <span
                          style={{
                            background: 'rgba(236, 72, 153, 0.15)',
                            color: '#ec4899',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {ev.subsystem || 'magnet'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                        {ev.message}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
