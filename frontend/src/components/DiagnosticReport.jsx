import React, { useState } from 'react';
import { Activity, AlertTriangle, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';

export const DiagnosticReport = ({ reportData, onNewUpload }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!reportData || !reportData.events) return null;

  const selectedEvent = reportData.events[selectedIndex];

  return (
    <div className="card" style={{ maxWidth: '1000px', margin: '0 auto', marginTop: '2rem', animation: 'fadeIn 0.5s ease-out', display: 'flex', flexDirection: 'column', height: '80vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', margin: 0 }}>
            <Activity /> Visor de Logs Philips (Modo Servicio)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Archivo procesado: {reportData.filename}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onNewUpload}>
          Subir Otro Archivo
        </button>
      </div>

      {/* Top Pane: Log List (Bitácora Densa tipo Philips Log Viewer) */}
      <div style={{ flex: '1 1 65%', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border)', backgroundColor: 'var(--bg-dark)', marginBottom: '1rem', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'monospace' }}>
          <thead style={{ backgroundColor: 'var(--bg-light)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, width: '80px' }}>Date</th>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, width: '90px' }}>Time</th>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, width: '100px' }}>Process</th>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, width: '100px' }}>Thread</th>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, width: '120px' }}>File</th>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, width: '80px' }}>Code</th>
              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {reportData.events.map((event, index) => {
              const isSelected = index === selectedIndex;
              
              // Parse the backend timestamp (e.g., "2026/08/04 10:33:06.781")
              const timeParts = event.timestamp.split(' ');
              const datePart = timeParts[0] ? timeParts[0].replace(/\//g, '.') : '';
              const timePart = timeParts[1] || '';

              // System styling
              let rowBg = 'transparent';
              let textColor = 'var(--text-muted)';
              if (isSelected) {
                rowBg = 'rgba(0, 210, 255, 0.15)'; // System primary transparent
                textColor = 'var(--text-main)';
              } else if (event.level.includes('ERROR') || event.level.includes('FATAL')) {
                textColor = 'var(--critical)';
              } else if (event.level.includes('WARNING')) {
                textColor = 'var(--warning)';
              }

              return (
                <tr 
                  key={index} 
                  onClick={() => setSelectedIndex(index)}
                  style={{ 
                    cursor: 'pointer', 
                    backgroundColor: rowBg,
                    color: textColor,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <td style={{ padding: '0.4rem 0.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{datePart}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{timePart}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{event.module || 'System'}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>{event.thread || 'Unknown'}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{event.file || 'X:/stargate2...'}</td>
                  <td style={{ padding: '0.4rem 0.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }}>
                    {event.code && event.code.length < 10 ? event.code : '256'}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'normal', wordBreak: 'break-word', minWidth: '300px' }}>
                    {event.code && event.code.length >= 10 ? event.code : event.message}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Divider / Action buttons (like the image) */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--bg-light)' }}>
        <div style={{ padding: '0.25rem 1rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
          --- SelectedIndex {selectedIndex} ---
        </div>
      </div>

      {/* Bottom Pane: Detailed Info */}
      <div style={{ flex: '1 1 35%', overflowY: 'auto', backgroundColor: 'var(--bg-light)', color: 'var(--text-main)', padding: '1.5rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', border: '1px solid var(--border)' }}>
        {selectedEvent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '130px', fontWeight: 600, color: 'var(--text-muted)' }}>ERROR_STRING:</span> 
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedEvent.code}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ width: '130px', fontWeight: 600, color: 'var(--text-muted)' }}>Explanation:</span> 
              <span style={{ whiteSpace: 'pre-wrap', flex: 1, color: 'var(--text-main)' }}>{selectedEvent.explanation || 'No explanation available in knowledge base.'}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ width: '130px', fontWeight: 600, color: 'var(--text-muted)' }}>Action:</span> 
              <span style={{ whiteSpace: 'pre-wrap', flex: 1, color: 'var(--success)' }}>{selectedEvent.action || 'No action defined.'}</span>
            </div>
            
            <div style={{ display: 'flex' }}>
              <span style={{ width: '130px', fontWeight: 600, color: 'var(--text-muted)' }}>Level:</span> 
              <span style={{ color: selectedEvent.level.includes('ERROR') || selectedEvent.level.includes('FATAL') ? 'var(--critical)' : 'var(--text-main)' }}>{selectedEvent.level}</span>
            </div>

            <div style={{ display: 'flex' }}>
              <span style={{ width: '130px', fontWeight: 600, color: 'var(--text-muted)' }}>Comments:</span> 
              <span style={{ color: 'var(--text-main)' }}>{selectedEvent.comments || 'N/A'}</span>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            Selecciona un evento de la lista superior para ver los detalles.
          </div>
        )}
      </div>

    </div>
  );
};
