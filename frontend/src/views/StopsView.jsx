import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AlertOctagon, HelpCircle } from 'lucide-react';

export const StopsView = () => {
  const { allEvents, setHelpCode } = useApp();

  const stopEvents = useMemo(() => {
    return allEvents.filter(
      (e) =>
        (e.message || '').toLowerCase().includes('abort') ||
        (e.message || '').toLowerCase().includes('stop') ||
        (e.message || '').toLowerCase().includes('interrup') ||
        (e.message || '').toLowerCase().includes('falla') ||
        e.severity === 'CRITICAL' ||
        e.severity === 'SEVERE_ERROR'
    );
  }, [allEvents]);

  return (
    <div className="stops-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertOctagon style={{ width: 22, height: 22, color: 'var(--critical)' }} />
            <h3>Fallas Agrupadas & Abortos de Escaneo ({stopEvents.length})</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Subsistema Afectado</th>
                <th>Código de Aborto</th>
                <th>Severidad</th>
                <th>Causa / Mensaje de Interrupción</th>
                <th style={{ textAlign: 'center' }}>Ayuda</th>
              </tr>
            </thead>
            <tbody>
              {stopEvents.length > 0 ? (
                stopEvents.map((ev, idx) => (
                  <tr key={ev.id || idx}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--critical)' }}>
                      {(ev.subsystem || 'SYSTEM').toUpperCase()}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {ev.tceCode || ev.process || 'ABORT-01'}
                    </td>
                    <td>
                      <span className="pill pill-critical">ABORTADO</span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{ev.message}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn glass-btn"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => setHelpCode(ev.tceCode || 'GE-ABORT-01')}
                      >
                        <HelpCircle style={{ width: 12, height: 12 }} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No se registran abortos ni interrupciones de escaneo.
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
