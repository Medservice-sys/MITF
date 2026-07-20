import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Thermometer, CheckCircle2 } from 'lucide-react';

export const MaintenanceView = () => {
  const { allEvents } = useApp();

  const warmupEvents = useMemo(() => {
    return allEvents.filter(
      (e) =>
        (e.message || '').toLowerCase().includes('warmup') ||
        (e.message || '').toLowerCase().includes('calentamiento') ||
        (e.message || '').toLowerCase().includes('routine') ||
        e.subsystem === 'tube'
    );
  }, [allEvents]);

  return (
    <div className="maintenance-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Thermometer style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Rutinas de Calentamiento de Tubo (Warm-up Routines) ({warmupEvents.length})</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Host</th>
                <th>Rutina / Proceso</th>
                <th>Estado Calentamiento</th>
                <th>Detalles Telemétricos</th>
              </tr>
            </thead>
            <tbody>
              {warmupEvents.length > 0 ? (
                warmupEvents.map((ev, idx) => (
                  <tr key={ev.id || idx}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent)' }}>
                      {ev.host || 'GE-CT-01'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {ev.process || 'tube_warmup'}
                    </td>
                    <td>
                      <span className="pill pill-success">COMPLETADO</span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{ev.message}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No se han registrado eventos de calentamiento de tubo en la jornada.
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
