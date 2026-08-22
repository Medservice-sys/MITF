import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HardDrive, Activity, Zap, Thermometer, ShieldCheck, CheckCircle2, AlertTriangle, Save, Snowflake } from 'lucide-react';

export const HardwareMriView = () => {
  const { mriMetrics, showToast } = useApp();

  const [minHeliumLimit, setMinHeliumLimit] = useState(60.0);
  const [maxBoreTempLimit, setMaxBoreTempLimit] = useState(38.0);
  const [maxMagnetPressure, setMaxMagnetPressure] = useState(5.5);

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

  const handleSaveConfig = (e) => {
    e.preventDefault();
    showToast('Límites de tolerancia de Criogenia y Bore guardados con éxito', 'success');
  };

  return (
    <div className="view-container">
      {/* Title */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.4)' }}>
            <HardDrive style={{ width: 26, height: 26, color: '#ec4899' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>
              Telemetría de Hardware & Criogenia Resonador (MRI)
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Monitoreo del imán superconductor 1.5T LCC, niveles de helio criogénico, gradientes HFD y temperaturas de bore
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Hardware Specs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Magnet & Cryo Details */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Snowflake style={{ width: 18, height: 18, color: '#38bdf8' }} /> Subsistema Criogénico & Imán
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nivel de Helio Líquido:</span>
              <strong style={{ color: heliumPercent >= minHeliumLimit ? '#10b981' : '#ef4444', fontSize: '0.95rem' }}>{heliumPercent}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Presión del Vasija Imán:</span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{magnetPressure} psi</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Campo Magnético B0:</span>
              <strong style={{ color: '#a855f7', fontSize: '0.95rem' }}>{magnetField}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Serie de Imán:</span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{magnetSerial}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Polaridad / Estado Rampa:</span>
              <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{rampStatus.toUpperCase()} (PASS)</strong>
            </div>
          </div>
        </div>

        {/* Gradient & RF Details */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap style={{ width: 18, height: 18, color: '#f59e0b' }} /> Gradientes & Amplificadores RF
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Amplificador Gradientes:</span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{gradientAmp}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Tiempo de Subida (Rise Time):</span>
              <strong style={{ color: '#f59e0b', fontSize: '0.95rem' }}>{gradientRiseTime} µs</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Amplificador RF Transmit:</span>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{rfAmpType}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Max Receiver Bandwidth:</span>
              <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>{bwkHz} kHz</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Límites de Seguridad B1 RMS:</span>
              <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>CORRECT (7.2 W/kg)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Threshold Configuration Form */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>
          Configuración de Umbrales de Seguridad MRI
        </h3>
        <form onSubmit={handleSaveConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Límite Mínimo Helio (%)
            </label>
            <input
              type="number"
              className="glass-input"
              value={minHeliumLimit}
              onChange={(e) => setMinHeliumLimit(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Temp. Max Bore (°C)
            </label>
            <input
              type="number"
              className="glass-input"
              value={maxBoreTempLimit}
              onChange={(e) => setMaxBoreTempLimit(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Max Presión Imán (psi)
            </label>
            <input
              type="number"
              step="0.1"
              className="glass-input"
              value={maxMagnetPressure}
              onChange={(e) => setMaxMagnetPressure(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <button type="submit" className="glass-btn primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Save style={{ width: 14, height: 14 }} />
              <span>Guardar Umbrales</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
