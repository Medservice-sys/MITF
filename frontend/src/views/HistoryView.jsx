import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Calendar, AlertTriangle } from 'lucide-react';

export const HistoryView = () => {
  const { allEvents, setHelpCode } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  // Group events by date (YYYY-MM-DD)
  const groupedEvents = useMemo(() => {
    const groups = {};
    let filtered = [...allEvents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (e) =>
          (e.subsystem || '').toLowerCase().includes(q) ||
          (e.message || '').toLowerCase().includes(q) ||
          (e.tceCode || '').toLowerCase().includes(q)
      );
    }

    filtered.forEach((ev) => {
      const dateStr = ev.timestamp ? ev.timestamp.substring(0, 10) : 'Fecha Desconocida';
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(ev);
    });

    return groups;
  }, [allEvents, searchQuery]);

  const dates = Object.keys(groupedEvents).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="history-view">
      <div className="filters-panel glass-panel" style={{ marginBottom: 16 }}>
        <div className="filter-group" style={{ gridColumn: '1 / -1' }}>
          <label>Buscar en Histórico por Contenido de Evento</label>
          <div className="search-box">
            <Search />
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="Buscar en historial consolidado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div
        className="glass-panel"
        style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderLeft: '4px solid var(--warning)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <AlertTriangle style={{ width: 18, height: 18, color: 'var(--warning)', flexShrink: 0 }} />
        <span>
          <strong>Aviso de Rendimiento:</strong> Se están mostrando únicamente los eventos registrados en la base de datos.
          Utilice la barra de búsqueda superior para filtrar días específicos.
        </span>
      </div>

      {dates.length > 0 ? (
        dates.map((date) => (
          <div key={date} className="glass-panel" style={{ padding: 18, marginBottom: 16 }}>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--primary)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Calendar style={{ width: 18, height: 18 }} />
              <span>{date}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                ({groupedEvents[date].length} eventos)
              </span>
            </div>

            <div className="table-wrapper">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Subsistema</th>
                    <th>Código</th>
                    <th>Severidad</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedEvents[date].map((ev, idx) => (
                    <tr key={ev.id || idx}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {ev.timestamp ? ev.timestamp.substring(11, 19) : '-'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {ev.subsystem ? ev.subsystem.toUpperCase() : 'CONSOLE'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        {ev.tceCode || ev.process || '-'}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            ev.severity === 'CRITICAL' || ev.severity === 'SEVERE_ERROR'
                              ? 'pill-critical'
                              : ev.severity === 'WARNING' || ev.severity === 'MAJOR_ERROR'
                              ? 'pill-warning'
                              : 'pill-info'
                          }`}
                        >
                          {ev.severity || 'INFO'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{ev.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="glass-panel" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
          No hay historial de eventos registrado.
        </div>
      )}
    </div>
  );
};
