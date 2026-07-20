import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Plus, Check } from 'lucide-react';

export const AdminClassificationsView = () => {
  const { showToast, refreshData } = useApp();

  const [classifications, setClassifications] = useState([]);
  const [editingSeverities, setEditingSeverities] = useState({});

  // New catalog entry form
  const [newCode, setNewCode] = useState('');
  const [newSubsystem, setNewSubsystem] = useState('console');
  const [newSeverity, setNewSeverity] = useState('WARNING');
  const [newDesc, setNewDesc] = useState('');

  const fetchClassifications = async () => {
    try {
      const res = await fetch('/api/admin/classifications');
      if (res.ok) {
        const data = await res.json();
        setClassifications(data);
        const map = {};
        data.forEach((c) => (map[c.tceCode] = c.severity));
        setEditingSeverities(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClassifications();
  }, []);

  const handleSeverityChange = (code, val) => {
    setEditingSeverities((prev) => ({ ...prev, [code]: val }));
  };

  const handleSaveOverride = async (item) => {
    const newSev = editingSeverities[item.tceCode] || item.severity;
    try {
      const res = await fetch('/api/admin/classifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tceCode: item.tceCode,
          subsystem: item.subsystem,
          severity: newSev,
          description: item.description,
        }),
      });

      if (res.ok) {
        showToast(`Override guardado para ${item.tceCode}: ${newSev}`, 'success');
        fetchClassifications();
        refreshData();
      } else {
        showToast('Error al guardar override', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  const handleAddCatalogEntry = async (e) => {
    e.preventDefault();
    if (!newCode || !newDesc) {
      showToast('Complete código y descripción para el nuevo evento', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/admin/classifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tceCode: newCode,
          subsystem: newSubsystem,
          severity: newSeverity,
          description: newDesc,
        }),
      });

      if (res.ok) {
        showToast('Código de evento agregado a la taxonomía', 'success');
        setNewCode('');
        setNewDesc('');
        fetchClassifications();
        refreshData();
      } else {
        showToast('Error al guardar nuevo código', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  return (
    <div className="admin-classifications-view">
      {/* Classification table */}
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Catálogo & Overrides de Clasificación de Alertas ({classifications.length} entradas)</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Código Evento (TCE)</th>
                <th>Subsistema</th>
                <th>Descripción del Catálogo</th>
                <th>Severidad Asignada</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {classifications.length > 0 ? (
                classifications.map((item) => (
                  <tr key={item.tceCode}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                      {item.tceCode}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {(item.subsystem || 'console').toUpperCase()}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{item.description}</td>
                    <td>
                      <select
                        className="glass-input"
                        style={{ padding: '4px 24px 4px 8px', fontSize: '0.8rem' }}
                        value={editingSeverities[item.tceCode] || item.severity}
                        onChange={(e) => handleSeverityChange(item.tceCode, e.target.value)}
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="SEVERE_ERROR">SEVERE_ERROR</option>
                        <option value="WARNING">WARNING</option>
                        <option value="MAJOR_ERROR">MAJOR_ERROR</option>
                        <option value="INFORMATIONAL">INFORMATIONAL</option>
                        <option value="INFO">INFO</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn glass-btn"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleSaveOverride(item)}
                      >
                        <Check style={{ width: 12, height: 12, color: 'var(--secondary)' }} />
                        <span>Guardar</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No hay reglas de clasificación en el catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add new catalog entry form */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <h4 style={{ fontSize: '0.92rem', marginBottom: 14 }}>Añadir Nuevo Código al Catálogo de Alertas</h4>
        <form onSubmit={handleAddCatalogEntry} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Código TCE / Evento
            </label>
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="ej. TCE-504"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Subsistema
            </label>
            <select
              className="glass-input"
              style={{ width: '100%' }}
              value={newSubsystem}
              onChange={(e) => setNewSubsystem(e.target.value)}
            >
              <option value="console">CONSOLE</option>
              <option value="ips">IPS</option>
              <option value="cooling">COOLING</option>
              <option value="table">TABLE</option>
              <option value="tube">TUBE</option>
              <option value="das">DAS</option>
              <option value="gantry">GANTRY</option>
              <option value="collimator">COLLIMATOR</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Severidad Inicial
            </label>
            <select
              className="glass-input"
              style={{ width: '100%' }}
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value)}
            >
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="INFORMATIONAL">INFORMATIONAL</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Descripción / Detalle Técnico
            </label>
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="Descripción del evento..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn glass-btn" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus style={{ width: 14, height: 14 }} /> Agregar
          </button>
        </form>
      </div>
    </div>
  );
};
