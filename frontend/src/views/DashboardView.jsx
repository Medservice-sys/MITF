import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SchematicRoom } from '../components/SchematicRoom';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  Users,
  Award,
  HelpCircle,
  Search,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export const DashboardView = () => {
  const {
    latestMetrics,
    allEvents,
    setActiveView,
    setShowRoiModal,
    setHelpCode,
    setContextMenu,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [miniSeverity, setMiniSeverity] = useState('ALL');
  const [sortField, setSortField] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  // KPI metrics
  const totalEvents = latestMetrics?.totalEvents || allEvents.length;
  const criticalCount = latestMetrics?.criticalCount || allEvents.filter((e) => e.severity === 'CRITICAL' || e.severity === 'SEVERE_ERROR').length;
  const warningCount = latestMetrics?.warningCount || allEvents.filter((e) => e.severity === 'WARNING' || e.severity === 'MAJOR_ERROR').length;
  const patientCount = latestMetrics?.patientCount || 42;

  // Health Indices
  const dhi = latestMetrics?.dhi !== undefined ? latestMetrics.dhi : 98.4;
  const thi = latestMetrics?.thi !== undefined ? latestMetrics.thi : 92.1;
  const fhi = latestMetrics?.fhi !== undefined ? latestMetrics.fhi : 1.6;
  const roi = latestMetrics?.roi !== undefined ? latestMetrics.roi : 18500;

  // Color helper for health index bars
  const getIndexColor = (val, isFhi = false) => {
    if (isFhi) {
      if (val < 5) return 'var(--secondary)';
      if (val < 15) return 'var(--warning)';
      return 'var(--critical)';
    }
    if (val >= 90) return 'var(--secondary)';
    if (val >= 75) return 'var(--warning)';
    return 'var(--critical)';
  };

  // Filtered mini logs table
  const filteredEvents = useMemo(() => {
    let result = [...allEvents];

    if (miniSeverity !== 'ALL') {
      result = result.filter((e) => {
        const sev = (e.severity || '').toUpperCase();
        if (miniSeverity === 'CRITICAL') return sev === 'CRITICAL' || sev === 'SEVERE_ERROR';
        if (miniSeverity === 'WARNING') return sev === 'WARNING' || sev === 'MAJOR_ERROR';
        if (miniSeverity === 'INFO') return sev === 'INFO' || sev === 'WARN_MINOR' || sev === 'INFORMATIONAL';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          (e.subsystem || '').toLowerCase().includes(q) ||
          (e.message || '').toLowerCase().includes(q) ||
          (e.tceCode || '').toLowerCase().includes(q) ||
          (e.process || '').toLowerCase().includes(q)
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

    return result.slice(0, 10);
  }, [allEvents, miniSeverity, searchQuery, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Chart data: Timeline activity line chart
  const timelineData = useMemo(() => {
    const labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Ahora'];
    const dataPoints = [4, 2, 12, 28, 19, 8, totalEvents > 0 ? totalEvents % 30 : 5];

    return {
      labels,
      datasets: [
        {
          label: 'Eventos Registrados',
          data: dataPoints,
          borderColor: '#00d2ff',
          backgroundColor: 'rgba(0, 210, 255, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#00d2ff',
        },
      ],
    };
  }, [totalEvents]);

  // Chart data: Doughnut severity chart
  const doughnutData = useMemo(() => {
    const infoCount = Math.max(0, totalEvents - criticalCount - warningCount);
    return {
      labels: ['Crítico', 'Advertencia', 'Informativo'],
      datasets: [
        {
          data: [criticalCount, warningCount, infoCount],
          backgroundColor: ['#ff4b2b', '#f9d423', '#4facfe'],
          borderWidth: 0,
        },
      ],
    };
  }, [totalEvents, criticalCount, warningCount]);

  const handleContextMenu = (e, eventData) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      eventData,
    });
  };

  const handleSchematicClick = (subsystem) => {
    setActiveView('logs');
    // Pre-fill search in logs
    window.__pendingLogSearch = subsystem;
  };

  return (
    <div className="dashboard-view">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card glass-panel">
          <div className="kpi-icon icon-bg-info">
            <Activity style={{ width: 22, height: 22, color: 'var(--primary)' }} />
          </div>
          <div>
            <div className="kpi-label">Eventos Totales</div>
            <h3>{totalEvents}</h3>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon icon-bg-critical">
            <AlertCircle style={{ width: 22, height: 22, color: 'var(--critical)' }} />
          </div>
          <div>
            <div className="kpi-label">Eventos Críticos</div>
            <h3 style={{ color: 'var(--critical)' }}>{criticalCount}</h3>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon icon-bg-warning">
            <AlertTriangle style={{ width: 22, height: 22, color: 'var(--warning)' }} />
          </div>
          <div>
            <div className="kpi-label">Advertencias</div>
            <h3 style={{ color: 'var(--warning)' }}>{warningCount}</h3>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon icon-bg-secondary">
            <Users style={{ width: 22, height: 22, color: 'var(--secondary)' }} />
          </div>
          <div>
            <div className="kpi-label">Pacientes Atendidos</div>
            <h3 style={{ color: 'var(--secondary)' }}>{patientCount}</h3>
          </div>
        </div>
      </div>

      {/* Health Indices */}
      <div className="section-title">ÍNDICES CUANTITATIVOS DE SALUD (HEALTH MODELING)</div>
      <div className="health-grid">
        <div className="health-card glass-panel">
          <div className="health-label">DHI &bull; Device Health Index</div>
          <div className="health-value-wrapper">
            <h2 style={{ color: getIndexColor(dhi) }}>{dhi.toFixed(1)}%</h2>
          </div>
          <div className="health-sub">Salud General del Equipo</div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, dhi)}%`, background: getIndexColor(dhi) }}
            ></div>
          </div>
        </div>

        <div className="health-card glass-panel">
          <div className="health-label">THI &bull; Tube Health Index</div>
          <div className="health-value-wrapper">
            <h2 style={{ color: getIndexColor(thi) }}>{thi.toFixed(1)}%</h2>
          </div>
          <div className="health-sub">Vida Útil del Tubo RX (mAs)</div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, thi)}%`, background: getIndexColor(thi) }}
            ></div>
          </div>
        </div>

        <div className="health-card glass-panel">
          <div className="health-label">FHI &bull; Failure Health Index</div>
          <div className="health-value-wrapper">
            <h2 style={{ color: getIndexColor(fhi, true) }}>{fhi.toFixed(1)}%</h2>
          </div>
          <div className="health-sub">Riesgo Imminente de Falla</div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, fhi * 5)}%`, background: getIndexColor(fhi, true) }}
            ></div>
          </div>
        </div>

        <div
          className="health-card glass-panel"
          style={{ cursor: 'pointer', transition: 'all 0.3s' }}
          onClick={() => setShowRoiModal(true)}
          title="Click para ver desglose de ROI Financiero"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="health-label">ROI &bull; Retorno Inversión</div>
            <Award style={{ width: 16, height: 16, color: 'var(--secondary)' }} />
          </div>
          <div className="health-value-wrapper">
            <h2 style={{ color: 'var(--secondary)' }}>Bs{roi.toLocaleString()}</h2>
          </div>
          <div className="health-sub" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Ver Desglose Financiero &rarr;
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: '100%', background: 'var(--secondary)' }}></div>
          </div>
        </div>
      </div>

      {/* Interactive Room Schematic SVG */}
      <SchematicRoom onSubsystemClick={handleSchematicClick} />

      {/* Charts Section */}
      <div className="charts-layout">
        <div className="chart-box glass-panel">
          <h3>Línea de Tiempo de Eventos y Actividad Telemétrica</h3>
          <div className="canvas-wrapper">
            <Line
              data={timelineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                  y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                },
              }}
            />
          </div>
        </div>

        <div className="chart-box glass-panel">
          <h3>Distribución por Severidad</h3>
          <div className="canvas-wrapper doughnut-wrapper">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { family: 'Outfit' } } } },
              }}
            />
          </div>
        </div>
      </div>

      {/* Mini Logs Table */}
      <div className="table-box glass-panel">
        <div className="table-header">
          <h3>Últimos Eventos de Telemetría (Monitoreo Real Time)</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  className={`btn glass-btn ${miniSeverity === sev ? 'active' : ''}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    background: miniSeverity === sev ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.05)',
                  }}
                  onClick={() => setMiniSeverity(sev)}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div className="search-box">
              <Search />
              <input
                type="text"
                className="glass-input"
                placeholder="Buscar evento..."
                style={{ padding: '6px 10px 6px 32px', fontSize: '0.82rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th className="sortable-header" onClick={() => handleSort('timestamp')}>Fecha / Hora</th>
                <th className="sortable-header" onClick={() => handleSort('subsystem')}>Subsistema</th>
                <th className="sortable-header" onClick={() => handleSort('tceCode')}>Código / Proc</th>
                <th className="sortable-header" onClick={() => handleSort('severity')}>Severidad</th>
                <th>Mensaje de Evento</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev, idx) => (
                  <tr
                    key={ev.id || idx}
                    onContextMenu={(e) => handleContextMenu(e, ev)}
                    style={{ cursor: 'context-menu' }}
                  >
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}
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
                    <td style={{ fontSize: '0.82rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.message}
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
                  <td colSpan={6} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No se encontraron eventos coincidentes.
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
