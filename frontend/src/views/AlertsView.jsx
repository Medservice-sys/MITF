import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Bell, AlertTriangle, AlertCircle, HelpCircle, Ticket } from 'lucide-react';

export const AlertsView = () => {
  const { allEvents, setHelpCode, setActiveView, setContextMenu } = useApp();

  const alertEvents = useMemo(() => {
    return allEvents.filter(
      (e) =>
        e.severity === 'CRITICAL' ||
        e.severity === 'SEVERE_ERROR' ||
        e.severity === 'WARNING' ||
        e.severity === 'MAJOR_ERROR'
    );
  }, [allEvents]);

  return (
    <div className="alerts-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell style={{ width: 22, height: 22, color: 'var(--warning)' }} />
            <h3>Alertas Tempranas & Advertencias Predictivas ({alertEvents.length} activas)</h3>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {alertEvents.length > 0 ? (
            alertEvents.map((ev, idx) => {
              const isCritical = ev.severity === 'CRITICAL' || ev.severity === 'SEVERE_ERROR';
              const borderColor = isCritical ? 'var(--critical)' : 'var(--warning)';

              return (
                <div
                  key={ev.id || idx}
                  className="glass-panel"
                  style={{
                    padding: 16,
                    borderLeft: `4px solid ${borderColor}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onContextMenu={(e) =>
                    setContextMenu({
                      x: e.pageX,
                      y: e.pageY,
                      eventData: ev,
                    })
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {isCritical ? (
                      <AlertCircle style={{ width: 24, height: 24, color: 'var(--critical)', flexShrink: 0 }} />
                    ) : (
                      <AlertTriangle style={{ width: 24, height: 24, color: 'var(--warning)', flexShrink: 0 }} />
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          [{ev.subsystem ? ev.subsystem.toUpperCase() : 'SISTEMA'}] {ev.tceCode || ev.process || 'ALERTA'}
                        </span>
                        <span className={`pill ${isCritical ? 'pill-critical' : 'pill-warning'}`}>
                          {ev.severity}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: 4 }}>
                        {ev.message}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                        Host: {ev.host || 'GE-CT-01'} &bull; Detectado: {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn glass-btn"
                      style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setHelpCode(ev.tceCode || 'GE-ALT-01')}
                    >
                      <HelpCircle style={{ width: 14, height: 14 }} /> Ayuda
                    </button>
                    <button
                      className="btn"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        background: 'var(--primary)',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      onClick={() => {
                        window.__pendingTicketEvent = ev;
                        setActiveView('bitacora');
                      }}
                    >
                      <Ticket style={{ width: 14, height: 14 }} /> Ticket
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-panel" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
              No hay alertas críticas ni advertencias activas en este momento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
