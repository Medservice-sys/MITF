import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2 } from 'lucide-react';

export const AcknowledgesView = () => {
  const { allEvents } = useApp();

  const ackEvents = useMemo(() => {
    return allEvents.filter(
      (e) => e.severity === 'INFORMATIONAL' || e.severity === 'INFO' || e.isAck === true
    );
  }, [allEvents]);

  return (
    <div className="acknowledges-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 style={{ width: 22, height: 22, color: 'var(--secondary)' }} />
            <h3>Alertas Reconocidas y Confirmadas (ACK Log) ({ackEvents.length})</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Subsistema</th>
                <th>Código Evento</th>
                <th>Estado ACK</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {ackEvents.length > 0 ? (
                ackEvents.map((ev, idx) => (
                  <tr key={ev.id || idx}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {(ev.subsystem || 'CONSOLE').toUpperCase()}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {ev.tceCode || ev.process || '-'}
                    </td>
                    <td>
                      <span className="pill pill-success">CONFIRMADO (ACK)</span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{ev.message}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No hay alertas reconocidas en el registro actual.
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
