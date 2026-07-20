import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Plus, Wrench, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

export const BitacoraView = () => {
  const { showToast, refreshData } = useApp();
  const { userRole, currentUser } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(null);

  // Ticket creation form states (Operator)
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketSeverity, setTicketSeverity] = useState('warning');
  const [ticketEngineer, setTicketEngineer] = useState('ing_campo');
  const [ticketLogs, setTicketLogs] = useState('');

  // Ticket resolution form states (Engineer)
  const [resolutionType, setResolutionType] = useState('field');
  const [remoteEvidence, setRemoteEvidence] = useState('');
  const [remoteResolved, setRemoteResolved] = useState('yes');
  const [reviewGeneral, setReviewGeneral] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Escalation & Parts & Calibration
  const [l1Done, setL1Done] = useState('yes');
  const [l1Success, setL1Success] = useState('yes');
  const [l1Masked, setL1Masked] = useState('no');
  const [l1Attempt, setL1Attempt] = useState('');
  const [l2Escalated, setL2Escalated] = useState('no');
  const [l2Engineer, setL2Engineer] = useState('');
  const [l2Diagnosis, setL2Diagnosis] = useState('');

  const [requiresParts, setRequiresParts] = useState('no');
  const [partsList, setPartsList] = useState([]);

  const [requiresCalib, setRequiresCalib] = useState('no');
  const [calibStatus, setCalibStatus] = useState('approved');
  const [clientApproval, setClientApproval] = useState('yes');
  const [calibNotes, setCalibNotes] = useState('');

  // Dynamic tasks
  const [tasks, setTasks] = useState([{ action: '', result: '' }]);

  // Auto-clearing proposal
  const [proposalAlarmId, setProposalAlarmId] = useState(null);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/maintenance/records');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Check pending ticket creation from context menu
  useEffect(() => {
    if (window.__pendingTicketEvent) {
      const ev = window.__pendingTicketEvent;
      setTicketTitle(`[${ev.tceCode || 'MITF'}] Falla en ${ev.subsystem || 'Subsistema'} - GE CT`);
      let sev = 'warning';
      if (ev.severity === 'CRITICAL' || ev.severity === 'SEVERE_ERROR') sev = 'critical';
      else if (ev.severity === 'WARNING' || ev.severity === 'MAJOR_ERROR') sev = 'major';
      setTicketSeverity(sev);
      setTicketLogs(ev.id || '');
      window.__pendingTicketEvent = null;
    }
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!ticketTitle) {
      showToast('Por favor ingrese un título para el ticket', 'warning');
      return;
    }

    const payload = {
      title: ticketTitle,
      severity: ticketSeverity,
      engineer: ticketEngineer,
      relatedLogs: ticketLogs,
      status: 'open',
    };

    try {
      const res = await fetch('/api/maintenance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Ticket abierto y asignado exitosamente al ingeniero de campo', 'success');
        setTicketTitle('');
        setTicketLogs('');
        fetchTickets();
        refreshData();
      } else {
        showToast('Error al crear ticket en el servidor', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión', 'error');
    }
  };

  const openResolution = (ticket) => {
    setActiveTicketId(ticket.id);
    setResolutionType(ticket.resolutionType || 'field');
    setRemoteEvidence(ticket.remoteEvidence || '');
    setRemoteResolved('yes');
    setReviewGeneral(ticket.reviewGeneral || '');
    setDiagnosis(ticket.diagnosis || '');

    setL1Done(ticket.l1TroubleshootingDone ? 'yes' : 'no');
    setL1Success(ticket.l1StandardSuccess ? 'yes' : 'no');
    setL1Masked(ticket.isMaskedFailure ? 'yes' : 'no');
    setL1Attempt(ticket.l1ResolutionAttempt || '');

    setL2Escalated(ticket.escalatedToL2 ? 'yes' : 'no');
    setL2Engineer(ticket.l2Engineer || '');
    setL2Diagnosis(ticket.l2Diagnosis || '');

    setRequiresParts(ticket.requiresParts ? 'yes' : 'no');
    setPartsList(ticket.partsNeeded ? JSON.parse(JSON.stringify(ticket.partsNeeded)) : []);

    setRequiresCalib(ticket.requiresCalibration ? 'yes' : 'no');
    setCalibStatus(ticket.calibrationStatus || 'approved');
    setClientApproval(ticket.clientApproval || 'yes');
    setCalibNotes(ticket.imageQualityNotes || '');

    setTasks(ticket.tasks && ticket.tasks.length > 0 ? ticket.tasks : [{ action: '', result: '' }]);
  };

  const handleAddPartRow = () => {
    setPartsList((prev) => [
      ...prev,
      { partNumber: '', description: '', status: 'requested', eta: '' },
    ]);
  };

  const handleUpdatePart = (index, field, value) => {
    setPartsList((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  const handleRemovePart = (index) => {
    setPartsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    setTasks((prev) => [...prev, { action: '', result: '' }]);
  };

  const handleUpdateTask = (index, field, value) => {
    setTasks((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  const handleSaveResolution = async (e) => {
    e.preventDefault();
    if (!activeTicketId) return;

    const currentTicket = tickets.find((t) => t.id === activeTicketId);
    if (!currentTicket) return;

    let status = 'closed';
    let alertMsg = 'Bitácora guardada y ticket cerrado exitosamente';

    if (resolutionType === 'remote') {
      if (!remoteEvidence.trim()) {
        showToast('Ingrese la evidencia remota para cerrar el ticket', 'warning');
        return;
      }
      if (remoteResolved === 'yes') {
        status = 'closed';
        alertMsg = 'Ticket cerrado remotamente con evidencia registrada';
      } else {
        status = 'En sitio';
        alertMsg = "Ticket escalado a 'En sitio' para intervención física";
      }
    }

    const updatedTicket = {
      ...currentTicket,
      status,
      dateClosed: status === 'closed' ? new Date().toISOString().slice(0, 10) : undefined,
      resolutionType,
      remoteEvidence: resolutionType === 'remote' ? remoteEvidence : undefined,
      reviewGeneral: resolutionType === 'field' ? reviewGeneral : undefined,
      diagnosis: resolutionType === 'field' ? diagnosis : undefined,
      tasks: resolutionType === 'field' ? tasks.filter((t) => t.action || t.result) : [],
      l1TroubleshootingDone: l1Done === 'yes',
      l1StandardSuccess: l1Success === 'yes',
      isMaskedFailure: l1Masked === 'yes',
      l1ResolutionAttempt: l1Attempt,
      escalatedToL2: l2Escalated === 'yes',
      l2Engineer: l2Escalated === 'yes' ? l2Engineer : undefined,
      l2Diagnosis: l2Escalated === 'yes' ? l2Diagnosis : undefined,
      requiresParts: requiresParts === 'yes',
      partsNeeded: requiresParts === 'yes' ? partsList : [],
      requiresCalibration: requiresCalib === 'yes',
      calibrationStatus: requiresCalib === 'yes' ? calibStatus : undefined,
      clientApproval: requiresCalib === 'yes' ? clientApproval : undefined,
      imageQualityNotes: requiresCalib === 'yes' ? calibNotes : undefined,
    };

    try {
      const res = await fetch('/api/maintenance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTicket),
      });

      if (res.ok) {
        showToast(alertMsg, 'success');
        setActiveTicketId(null);
        fetchTickets();
        refreshData();
      } else {
        showToast('Error al guardar resolución de ticket', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  const activeRole = userRole || 'operator';
  const displayTickets =
    activeRole === 'engineer' && currentUser
      ? tickets.filter((t) => t.engineer && t.engineer.toLowerCase() === currentUser.toLowerCase())
      : tickets;

  return (
    <div className="bitacora-view">
      <div style={{ display: 'grid', gridTemplateColumns: activeRole === 'engineer' ? '1fr' : '1fr 1.5fr', gap: 16 }}>
        {/* Ticket Creation Form (Operator) */}
        {activeRole !== 'engineer' && (
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <BookOpen style={{ width: 20, height: 20, color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>1. Apertura de Ticket & Asignación</h3>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Título del Ticket / Resumen de Falla *
                </label>
                <input
                  type="text"
                  className="glass-input"
                  style={{ width: '100%' }}
                  placeholder="ej. Ruido atípico en rotor del Gantry durante disparo"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                    Severidad
                  </label>
                  <select
                    className="glass-input"
                    style={{ width: '100%' }}
                    value={ticketSeverity}
                    onChange={(e) => setTicketSeverity(e.target.value)}
                  >
                    <option value="warning">Warning (Menor)</option>
                    <option value="major">Major (Mayor)</option>
                    <option value="critical">Critical (Crítica)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                    Ingeniero Asignado
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    style={{ width: '100%' }}
                    value={ticketEngineer}
                    onChange={(e) => setTicketEngineer(e.target.value)}
                    placeholder="ing_campo / nombre"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  ID de Eventos / Logs Relacionados (Opcional)
                </label>
                <input
                  type="text"
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={ticketLogs}
                  onChange={(e) => setTicketLogs(e.target.value)}
                  placeholder="ID de log o código de error"
                />
              </div>

              <button
                type="submit"
                className="btn"
                style={{ background: 'var(--primary)', color: '#000', fontWeight: 700, marginTop: 8 }}
              >
                Abrir & Asignar Ticket
              </button>
            </form>
          </div>
        )}

        {/* Tickets Timeline / List */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Wrench style={{ width: 20, height: 20, color: 'var(--warning)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>2. Tickets & Bitácoras en Registro</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
            {displayTickets.length > 0 ? (
              displayTickets.map((t) => {
                let borderCol = 'var(--info)';
                if (t.severity === 'critical') borderCol = 'var(--critical)';
                else if (t.severity === 'major') borderCol = 'var(--warning)';

                const isClosed = t.status === 'closed' || t.status === 'Cerrado';

                return (
                  <div
                    key={t.id}
                    className="glass-panel"
                    style={{
                      padding: 14,
                      borderLeft: `4px solid ${borderCol}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => openResolution(t)}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        Ticket #{t.id}: {t.title}
                      </strong>
                      <span className={`pill ${t.severity === 'critical' ? 'pill-critical' : 'pill-warning'}`}>
                        {t.severity}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 6 }}>
                      Asignado: {t.engineer || 'N/A'} &bull; Logs: {t.relatedLogs || 'N/A'}
                    </div>

                    <div style={{ fontSize: '0.78rem', marginTop: 6 }}>
                      {isClosed ? (
                        <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                          Cerrado ({t.resolutionType === 'remote' ? 'Remoto' : 'En Sitio'})
                        </span>
                      ) : (
                        <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                          En Proceso &bull; Click para llenar resolución &rarr;
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
                No hay tickets ni bitácoras registradas.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Resolution Panel */}
      {activeTicketId && (
        <div className="glass-panel" style={{ padding: 24, marginTop: 20, borderTop: '3px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
              3. Resolución y Bitácora - Ticket #{activeTicketId}
            </h3>
            <button className="btn glass-btn" onClick={() => setActiveTicketId(null)}>
              Cerrar Panel
            </button>
          </div>

          <form onSubmit={handleSaveResolution} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Tipo de Resolución
                </label>
                <select
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                >
                  <option value="field">Intervención En Sitio (Presencial)</option>
                  <option value="remote">Resolución Remota (Backup / SSH / Config)</option>
                </select>
              </div>

              {resolutionType === 'remote' ? (
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                    Evidencia Remota *
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    style={{ width: '100%' }}
                    placeholder="Log de backup, comando ejecutado o confirmación"
                    value={remoteEvidence}
                    onChange={(e) => setRemoteEvidence(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                    Revisión General
                  </label>
                  <input
                    type="text"
                    className="glass-input"
                    style={{ width: '100%' }}
                    placeholder="Resumen de verificación inicial..."
                    value={reviewGeneral}
                    onChange={(e) => setReviewGeneral(e.target.value)}
                  />
                </div>
              )}
            </div>

            {resolutionType === 'field' && (
              <>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                    Diagnóstico Técnico de Campo
                  </label>
                  <textarea
                    className="glass-input"
                    rows={3}
                    style={{ width: '100%', resize: 'vertical' }}
                    placeholder="Describa la causa raíz identificada..."
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                  />
                </div>

                {/* Escalation fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                      Troubleshooting Nivel L1 Ejecutado
                    </label>
                    <select className="glass-input" style={{ width: '100%' }} value={l1Done} onChange={(e) => setL1Done(e.target.value)}>
                      <option value="yes">Sí (Completado)</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                      Escalado a Nivel L2 (Especialista)
                    </label>
                    <select className="glass-input" style={{ width: '100%' }} value={l2Escalated} onChange={(e) => setL2Escalated(e.target.value)}>
                      <option value="no">No</option>
                      <option value="yes">Sí (Escalado)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                      Requiere Repuestos
                    </label>
                    <select className="glass-input" style={{ width: '100%' }} value={requiresParts} onChange={(e) => setRequiresParts(e.target.value)}>
                      <option value="no">No</option>
                      <option value="yes">Sí</option>
                    </select>
                  </div>
                </div>

                {/* Parts dynamic list */}
                {requiresParts === 'yes' && (
                  <div className="glass-panel" style={{ padding: 14, background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Piezas & Repuestos Solicitados</h4>
                      <button type="button" className="btn glass-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={handleAddPartRow}>
                        + Añadir Pieza
                      </button>
                    </div>

                    {partsList.map((part, pIdx) => (
                      <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          className="glass-input"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          placeholder="P/N (ej. 4535612)"
                          value={part.partNumber || ''}
                          onChange={(e) => handleUpdatePart(pIdx, 'partNumber', e.target.value)}
                        />
                        <input
                          type="text"
                          className="glass-input"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          placeholder="Descripción"
                          value={part.description || ''}
                          onChange={(e) => handleUpdatePart(pIdx, 'description', e.target.value)}
                        />
                        <select
                          className="glass-input"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          value={part.status || 'requested'}
                          onChange={(e) => handleUpdatePart(pIdx, 'status', e.target.value)}
                        >
                          <option value="requested">Solicitado</option>
                          <option value="in_transit">En Tránsito</option>
                          <option value="received">Recibido</option>
                          <option value="installed">Instalado</option>
                        </select>
                        <input
                          type="date"
                          className="glass-input"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          value={part.eta || ''}
                          onChange={(e) => handleUpdatePart(pIdx, 'eta', e.target.value)}
                        />
                        <button type="button" className="btn glass-btn" style={{ color: 'var(--critical)', padding: '4px 8px' }} onClick={() => handleRemovePart(pIdx)}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dynamic Task Checklist */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Acciones de Campo & Checklist de Tareas</h4>
                    <button type="button" className="btn glass-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={handleAddTask}>
                      + Añadir Tarea
                    </button>
                  </div>

                  {tasks.map((tk, tIdx) => (
                    <div key={tIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Acción tomada (ej. Ajuste de voltaje inversor...)"
                        value={tk.action || ''}
                        onChange={(e) => handleUpdateTask(tIdx, 'action', e.target.value)}
                      />
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Resultado / Observación"
                        value={tk.result || ''}
                        onChange={(e) => handleUpdateTask(tIdx, 'result', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
              <button type="button" className="btn glass-btn" onClick={() => setActiveTicketId(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn" style={{ background: 'var(--secondary)', color: '#000', fontWeight: 700 }}>
                Guardar Resolution & Cerrar Ticket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
