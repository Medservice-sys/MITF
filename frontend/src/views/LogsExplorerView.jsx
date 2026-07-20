import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, HelpCircle, Ticket, Filter } from 'lucide-react';

export const LogsExplorerView = () => {
  const { allEvents, setHelpCode, setContextMenu, setActiveView } = useApp();

  const [searchQuery, setSearchQuery] = useState(() => window.__pendingLogSearch || '');
  const [subsystemFilter, setSubsystemFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (window.__pendingLogSearch) {
      setSearchQuery(window.__pendingLogSearch);
      window.__pendingLogSearch = null;
    }
  }, []);

  const subsystemsList = useMemo(() => {
    const defaultList = ['console', 'cooling', 'table', 'tube', 'das', 'gantry', 'collimator', 'detector', 'hv_generator', 'obc', 'tgp', 'rcib', 'system', 'network', 'dicom'];
    const set = new Set(defaultList);
    allEvents.forEach((ev) => {
      if (ev.subsystem) set.add(ev.subsystem.toLowerCase());
    });
    return Array.from(set).sort();
  }, [allEvents]);

  // Filtered log events
  const filteredEvents = useMemo(() => {
    let result = [...allEvents];

    if (severityFilter !== 'ALL') {
      result = result.filter((e) => {
        const sev = (e.severity || '').toUpperCase();
        if (severityFilter === 'CRITICAL') return sev === 'CRITICAL' || sev === 'SEVERE_ERROR';
        if (severityFilter === 'WARNING') return sev === 'WARNING' || sev === 'MAJOR_ERROR';
        if (severityFilter === 'INFO') return sev === 'INFO' || sev === 'WARN_MINOR' || sev === 'INFORMATIONAL';
        return true;
      });
    }

    if (subsystemFilter) {
      result = result.filter((e) => (e.subsystem || '').toLowerCase() === subsystemFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          (e.subsystem || '').toLowerCase().includes(q) ||
          (e.message || '').toLowerCase().includes(q) ||
          (e.tceCode || '').toLowerCase().includes(q) ||
          (e.process || '').toLowerCase().includes(q) ||
          (e.host || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'timestamp') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allEvents, severityFilter, subsystemFilter, searchQuery, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleContextMenu = (e, eventData) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      eventData,
    });
  };

  return (
    <div className="logs-explorer-view">
      {/* Filters Panel */}
      <div className="filters-panel glass-panel">
        <div className="filter-group">
          <label>Búsqueda General / Texto Libre</label>
          <div className="search-box">
            <Search />
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="Buscar por mensaje, código, subsistema, host..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Subsistema Físico</label>
          <select
            className="glass-input"
            value={subsystemFilter}
            onChange={(e) => {
              setSubsystemFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">-- Todos los Subsistemas ({subsystemsList.length}) --</option>
            {subsystemsList.map((sub) => (
              <option key={sub} value={sub}>
                {sub.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Filtro de Severidad</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
              <button
                key={sev}
                className={`btn glass-btn ${severityFilter === sev ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: '0.78rem',
                  background: severityFilter === sev ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.05)',
                }}
                onClick={() => {
                  setSeverityFilter(sev);
                  setCurrentPage(1);
                }}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Logs Table Box */}
      <div className="table-box glass-panel">
        <div className="table-header">
          <h3>
            Explorador Consolidado de Telemetría ({filteredEvents.length} eventos coincidentes)
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Mostrar:</span>
            <select
              className="glass-input"
              style={{ padding: '4px 24px 4px 8px', fontSize: '0.8rem' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={15}>15 por pág.</option>
              <option value={30}>30 por pág.</option>
              <option value={50}>50 por pág.</option>
              <option value={100}>100 por pág.</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th className="sortable-header" onClick={() => handleSort('timestamp')}>Fecha / Hora</th>
                <th className="sortable-header" onClick={() => handleSort('host')}>Host</th>
                <th className="sortable-header" onClick={() => handleSort('subsystem')}>Subsistema</th>
                <th className="sortable-header" onClick={() => handleSort('tceCode')}>Código / Proc</th>
                <th className="sortable-header" onClick={() => handleSort('severity')}>Severidad</th>
                <th>Mensaje de Log Telemétrico</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.length > 0 ? (
                paginatedEvents.map((ev, idx) => (
                  <tr
                    key={ev.id || idx}
                    onContextMenu={(e) => handleContextMenu(e, ev)}
                    style={{ cursor: 'context-menu' }}
                  >
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent)' }}>
                      {ev.host || 'GE-CT-01'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {ev.subsystem ? ev.subsystem.toUpperCase() : 'CONSOLE'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {ev.tceCode || ev.process || 'MITF-01'}
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
                    <td style={{ fontSize: '0.82rem' }}>
                      {ev.message}
                      {ev.ticketId && (
                        <span
                          className="pill pill-success"
                          style={{ marginLeft: 8, cursor: 'pointer' }}
                          onClick={() => setActiveView('bitacora')}
                        >
                          <Ticket style={{ width: 10, height: 10, display: 'inline', marginRight: 2 }} />
                          Ticket #{ev.ticketId}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn glass-btn"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={() => setHelpCode(ev.tceCode || 'GE-CT-01')}
                      >
                        <HelpCircle style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} /> Ayuda
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center" style={{ padding: 24, color: 'var(--text-dim)' }}>
                    No se encontraron registros de logs coincidentes con los filtros especificados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="pagination-wrapper">
          <div className="pagination-info">
            Mostrando página {currentPage} de {totalPages} ({filteredEvents.length} registros totales)
          </div>
          <div className="pagination-buttons">
            <button
              className="btn glass-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              &larr; Anterior
            </button>
            <button
              className="btn glass-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
