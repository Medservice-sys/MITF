import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Radio, RefreshCw, Plus, Play } from 'lucide-react';

export const DicomView = () => {
  const { showToast } = useApp();

  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pingingId, setPingingId] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [aeTitle, setAeTitle] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(104);

  const fetchStations = async () => {
    try {
      const res = await fetch('/api/dicom/stations');
      if (res.ok) {
        const data = await res.json();
        setStations(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handlePingStation = async (id) => {
    setPingingId(id);
    try {
      const res = await fetch('/api/dicom/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showToast('Prueba C-ECHO completada', 'success');
      } else {
        showToast('Fallo en prueba C-ECHO', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión al realizar C-ECHO', 'error');
    } finally {
      setPingingId(null);
      fetchStations();
    }
  };

  const handlePingAll = async () => {
    setIsLoading(true);
    try {
      for (const s of stations) {
        await fetch('/api/dicom/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: s.id }),
        });
      }
      showToast('Pruebas C-ECHO en todas las estaciones completadas', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al probar estaciones', 'error');
    } finally {
      setIsLoading(false);
      fetchStations();
    }
  };

  const handleAddStation = async (e) => {
    e.preventDefault();
    if (!name || !aeTitle || !ip || !port) {
      showToast('Por favor completa todos los campos de la estación DICOM', 'warning');
      return;
    }

    const newStation = {
      id: 'station_' + Date.now(),
      name,
      aeTitle,
      ip,
      port: Number(port),
      status: 'unknown',
      latency: '-',
      lastChecked: '-',
    };

    const updated = [...stations, newStation];

    try {
      const res = await fetch('/api/dicom/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        showToast('Estación DICOM agregada exitosamente', 'success');
        setName('');
        setAeTitle('');
        setIp('');
        setPort(104);
        fetchStations();
      } else {
        showToast('Error al guardar estación DICOM', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  return (
    <div className="dicom-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Estaciones de Red DICOM & Colectores PACS (C-ECHO Ping)</h3>
          </div>

          <button
            className="btn"
            style={{
              background: 'var(--primary)',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={handlePingAll}
            disabled={isLoading}
          >
            <Play style={{ width: 14, height: 14 }} />
            <span>{isLoading ? 'Probando...' : 'Probar C-ECHO en Todas'}</span>
          </button>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Nombre Estación / PACS</th>
                <th>AE Title</th>
                <th>IP & Puerto</th>
                <th>Estado C-ECHO</th>
                <th>Latencia</th>
                <th>Última Verificación</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {stations.length > 0 ? (
                stations.map((s) => {
                  let dotClass = 'dot-red';
                  let statusText = 'Desconectado';
                  if (s.status === 'online') {
                    dotClass = 'dot-green';
                    statusText = 'Activo / OK';
                  } else if (s.status === 'degraded') {
                    dotClass = 'dot-red';
                    statusText = 'Degradado (Rechazo)';
                  }

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{s.aeTitle}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', opacity: 0.8 }}>
                        {s.ip}:{s.port}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`dot ${dotClass}`} style={{ width: 8, height: 8 }}></span>
                          <span style={{ fontSize: '0.78rem' }}>{statusText}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{s.latency}</td>
                      <td style={{ fontSize: '0.75rem', opacity: 0.7 }}>{s.lastChecked}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn glass-btn"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handlePingStation(s.id)}
                          disabled={pingingId === s.id}
                        >
                          <RefreshCw style={{ width: 11, height: 11 }} />
                          <span>{pingingId === s.id ? 'Probando...' : 'Probar C-ECHO'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No hay estaciones DICOM configuradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add DICOM station form */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <h4 style={{ fontSize: '0.92rem', marginBottom: 14 }}>Registrar Nueva Estación DICOM</h4>
        <form onSubmit={handleAddStation} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Nombre Nodo / PACS
            </label>
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="PACS Central"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              AE Title
            </label>
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="STORE_SCP"
              value={aeTitle}
              onChange={(e) => setAeTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Dirección IP
            </label>
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="192.168.1.100"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Puerto DICOM
            </label>
            <input
              type="number"
              className="glass-input"
              style={{ width: '100%' }}
              placeholder="104 / 11112"
              value={port}
              onChange={(e) => setPort(e.target.value)}
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
