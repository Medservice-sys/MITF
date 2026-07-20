import React from 'react';
import { useApp } from '../context/AppContext';
import { X, DollarSign, TrendingUp, ShieldAlert, Award } from 'lucide-react';

export const RoiModal = () => {
  const { showRoiModal, setShowRoiModal, latestMetrics } = useApp();

  if (!showRoiModal) return null;

  const details = latestMetrics?.roiDetails || {
    totalAvoided: 0,
    totalIntervention: 0,
    resolvedTickets: [],
  };
  const netRoi = latestMetrics?.roi || 0;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 750 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award style={{ width: 22, height: 22, color: 'var(--secondary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Retorno de Inversión (ROI) - Desglose Financiero</h3>
          </div>
          <button
            onClick={() => setShowRoiModal(false)}
            className="icon-btn"
            style={{ width: 32, height: 32, borderRadius: 6 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div className="glass-panel" style={{ padding: 14, textOverFlow: 'ellipsis' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Costos Evitados</div>
              <h3 style={{ color: 'var(--secondary)', fontSize: '1.4rem', marginTop: 4 }}>
                Bs{details.totalAvoided.toFixed(2)}
              </h3>
            </div>
            <div className="glass-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Costos Intervención</div>
              <h3 style={{ color: 'var(--critical)', fontSize: '1.4rem', marginTop: 4 }}>
                Bs{details.totalIntervention.toFixed(2)}
              </h3>
            </div>
            <div className="glass-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ROI Neto Acumulado</div>
              <h3 style={{ color: 'var(--primary)', fontSize: '1.4rem', marginTop: 4 }}>
                Bs{netRoi.toFixed(2)}
              </h3>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: 10, color: 'var(--text-dim)' }}>
              Tickets Resueltos que Impactan el ROI
            </h4>
            <div className="table-wrapper" style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Título</th>
                    <th>Severidad</th>
                    <th style={{ textAlign: 'right' }}>Evitado</th>
                    <th style={{ textAlign: 'right' }}>Intervención</th>
                  </tr>
                </thead>
                <tbody>
                  {details.resolvedTickets && details.resolvedTickets.length > 0 ? (
                    details.resolvedTickets.map((tk) => (
                      <tr key={tk.id}>
                        <td style={{ fontWeight: 600, color: 'var(--info)' }}>{tk.id}</td>
                        <td>{tk.title}</td>
                        <td>
                          <span
                            className={`pill ${
                              tk.severity === 'critical'
                                ? 'pill-critical'
                                : tk.severity === 'major'
                                ? 'pill-major'
                                : 'pill-warning'
                            }`}
                          >
                            {tk.severity}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--secondary)', fontWeight: 500 }}>
                          Bs{tk.avoidedCost?.toFixed(2) || '0.00'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--critical)', fontWeight: 500 }}>
                          Bs{tk.interventionCost?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                        No hay tickets resueltos o cerrados registrados actualmente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn glass-btn" onClick={() => setShowRoiModal(false)}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
