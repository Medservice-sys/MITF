import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export const SchematicRoom = ({ onSubsystemClick }) => {
  const { allEvents } = useApp();

  // Compute status for each subsystem
  const subsystemStatuses = useMemo(() => {
    const subsystems = ['console', 'ips', 'cooling', 'table', 'tube', 'das', 'gantry', 'collimator'];
    const statuses = {};
    subsystems.forEach((s) => (statuses[s] = 'healthy'));

    allEvents.forEach((ev) => {
      const sub = (ev.subsystem || '').toLowerCase();
      if (subsystems.includes(sub)) {
        const sev = (ev.severity || '').toUpperCase();
        if (sev === 'SEVERE_ERROR' || sev === 'CRITICAL' || sev === 'SEVERE') {
          statuses[sub] = 'critical';
        } else if (sev === 'WARNING' && statuses[sub] !== 'critical') {
          statuses[sub] = 'warning';
        }
      }
    });

    return statuses;
  }, [allEvents]);

  const getSubsystemClass = (sub) => {
    const st = subsystemStatuses[sub] || 'healthy';
    if (st === 'critical') return 'svg-critical';
    if (st === 'warning') return 'svg-warning';
    return 'svg-healthy';
  };

  const handleClick = (sub) => {
    if (onSubsystemClick) onSubsystemClick(sub);
  };

  return (
    <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Esquema Físico & Interactivo - Sala de Tomografía GE CT</h3>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2ecc71' }}></span> Normal
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffd84d' }}></span> Advertencia
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4b2b' }}></span> Crítico
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 260, position: 'relative' }}>
        <svg viewBox="0 0 900 320" style={{ width: '100%', height: '100%', borderRadius: 12 }}>
          {/* Background room outline */}
          <rect x="10" y="10" width="880" height="300" rx="16" fill="rgba(10, 14, 20, 0.6)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />

          {/* Room Divider Lines */}
          <line x1="260" y1="10" x2="260" y2="310" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="6,6" />
          <text x="130" y="32" fill="var(--text-dim)" fontSize="12" textAnchor="middle" fontWeight="600">SALA DE CONTROL</text>
          <text x="580" y="32" fill="var(--text-dim)" fontSize="12" textAnchor="middle" fontWeight="600">SALA DE EXPLORACIÓN / ESCANER</text>

          {/* CONSOLE Group */}
          <g
            className={`svg-element ${getSubsystemClass('console')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('console')}
          >
            <rect x="40" y="80" width="180" height="120" rx="10" strokeWidth="2" />
            <text x="130" y="135" fill="#fff" fontSize="13" fontWeight="700" textAnchor="middle">CONSOLA OPERADOR</text>
            <text x="130" y="155" fill="var(--text-dim)" fontSize="11" textAnchor="middle">[Console / OBC]</text>
          </g>

          {/* POWER IPS Group */}
          <g
            className={`svg-element ${getSubsystemClass('ips')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('ips')}
          >
            <rect x="40" y="215" width="180" height="70" rx="8" strokeWidth="2" />
            <text x="130" y="255" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">ARMARIO IPS / POWER</text>
          </g>

          {/* COOLING UNIT Group */}
          <g
            className={`svg-element ${getSubsystemClass('cooling')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('cooling')}
          >
            <rect x="290" y="60" width="100" height="110" rx="8" strokeWidth="2" />
            <text x="340" y="115" fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle">UNIDAD ENFRIAMIENTO</text>
            <text x="340" y="132" fill="var(--text-dim)" fontSize="10" textAnchor="middle">[Cooling / Chiller]</text>
          </g>

          {/* GANTRY Ring */}
          <g
            className={`svg-element ${getSubsystemClass('gantry')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('gantry')}
          >
            <circle cx="600" cy="170" r="105" strokeWidth="3" />
            <circle cx="600" cy="170" r="65" fill="rgba(10, 14, 20, 0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <text x="600" y="165" fill="#fff" fontSize="14" fontWeight="800" textAnchor="middle">GANTRY GE</text>
            <text x="600" y="182" fill="var(--text-dim)" fontSize="10" textAnchor="middle">[TG / Rotor / Drive]</text>
          </g>

          {/* TUBE Subsystem inside Gantry */}
          <g
            className={`svg-element ${getSubsystemClass('tube')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('tube')}
          >
            <rect x="565" y="80" width="70" height="30" rx="6" strokeWidth="2" />
            <text x="600" y="99" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">TUBO RX</text>
          </g>

          {/* DAS Subsystem inside Gantry */}
          <g
            className={`svg-element ${getSubsystemClass('das')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('das')}
          >
            <rect x="565" y="230" width="70" height="30" rx="6" strokeWidth="2" />
            <text x="600" y="249" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">DAS / DETECT</text>
          </g>

          {/* COLLIMATOR Subsystem */}
          <g
            className={`svg-element ${getSubsystemClass('collimator')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('collimator')}
          >
            <rect x="660" y="155" width="40" height="30" rx="4" strokeWidth="2" />
            <text x="680" y="174" fill="#fff" fontSize="9" fontWeight="700" textAnchor="middle">COLIM</text>
          </g>

          {/* TABLE Patient Couch Group */}
          <g
            className={`svg-element ${getSubsystemClass('table')}`}
            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
            onClick={() => handleClick('table')}
          >
            <rect x="710" y="145" width="160" height="50" rx="8" strokeWidth="2" />
            <text x="790" y="175" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">MESA PACIENTE</text>
          </g>
        </svg>
      </div>
    </div>
  );
};
