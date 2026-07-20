import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Check, Ticket, Eye, Users, HelpCircle } from 'lucide-react';

export const ContextMenu = () => {
  const { contextMenu, setContextMenu, setActiveView, showToast, setHelpCode } = useApp();

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [setContextMenu]);

  if (!contextMenu) return null;

  const { x, y, eventData } = contextMenu;

  const handleAckAlarm = async (e) => {
    e.stopPropagation();
    setContextMenu(null);
    if (!eventData) return;

    try {
      const res = await fetch('/api/admin/classifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tceCode: eventData.tceCode || eventData.process,
          severity: 'INFORMATIONAL',
        }),
      });

      if (res.ok) {
        showToast(`Alarma ${eventData.id || 'seleccionada'} reconocida. Severidad reajustada.`, 'success');
        setActiveView('acknowledges');
      } else {
        showToast('Error al reconocer la alarma', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al reconocer alarma', 'error');
    }
  };

  const handleCreateTicket = (e) => {
    e.stopPropagation();
    setContextMenu(null);
    if (!eventData) return;

    // Save linked event context in sessionStorage or dispatch custom event for Bitacora view
    window.__pendingTicketEvent = eventData;
    setActiveView('bitacora');
  };

  const handleViewDetail = (e) => {
    e.stopPropagation();
    setContextMenu(null);
    if (!eventData) return;

    if (eventData.tceCode) {
      setHelpCode(eventData.tceCode);
    } else {
      alert(`Detalle del evento:\nSubsystem: ${eventData.subsystem || '-'}\nProcess: ${eventData.process || '-'}\nMessage: ${eventData.message}`);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
        background: 'rgba(16, 22, 32, 0.95)',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(16px)',
        borderRadius: 10,
        padding: '6px 0',
        minWidth: 200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {!eventData?.ticketId && (
        <button
          onClick={handleAckAlarm}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 14px',
            background: 'none',
            border: 'none',
            color: 'var(--text-main)',
            fontSize: '0.82rem',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Check style={{ width: 14, height: 14, color: 'var(--secondary)' }} />
          <span>Reconocer Alarma (ACK)</span>
        </button>
      )}

      <button
        onClick={handleCreateTicket}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '8px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text-main)',
          fontSize: '0.82rem',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
      >
        {eventData?.ticketId ? (
          <>
            <Eye style={{ width: 14, height: 14, color: 'var(--secondary)' }} />
            <span>Ver Ticket #{eventData.ticketId}</span>
          </>
        ) : (
          <>
            <Ticket style={{ width: 14, height: 14, color: 'var(--primary)' }} />
            <span>Crear Ticket ATREC</span>
          </>
        )}
      </button>

      <button
        onClick={handleViewDetail}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '8px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text-main)',
          fontSize: '0.82rem',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
      >
        <HelpCircle style={{ width: 14, height: 14, color: 'var(--info)' }} />
        <span>Ver Ayuda Técnica / Código</span>
      </button>
    </div>
  );
};
