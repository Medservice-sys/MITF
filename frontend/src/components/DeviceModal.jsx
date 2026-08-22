import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Save, Server } from 'lucide-react';

export const DeviceModal = () => {
  const { deviceModalData, setDeviceModalData, devicesList, operationMode, refreshInterval, refreshData, showToast } = useApp();

  const [name, setName] = useState('');
  const [modality, setModality] = useState('CT');
  const [brand, setBrand] = useState('GE');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [remoteLogDir, setRemoteLogDir] = useState('/usr/g/service/log');
  const [sshMode, setSshMode] = useState('legacy');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (deviceModalData && typeof deviceModalData === 'object' && deviceModalData.id) {
      setName(deviceModalData.name || '');
      setModality(deviceModalData.modality || 'CT');
      setBrand(deviceModalData.brand || 'GE');
      setHost(deviceModalData.host || '');
      setPort(deviceModalData.port || 22);
      setUser(deviceModalData.user || '');
      setPassword('');
      setRemoteLogDir(deviceModalData.remoteLogDir || '/usr/g/service/log');
      setSshMode(deviceModalData.sshMode || 'legacy');
      setActive(deviceModalData.active !== false);
    } else {
      setName('');
      setModality('CT');
      setBrand('GE');
      setHost('');
      setPort(22);
      setUser('');
      setPassword('');
      setRemoteLogDir('/usr/g/service/log');
      setSshMode('legacy');
      setActive(true);
    }
  }, [deviceModalData]);

  if (!deviceModalData) return null;

  const handleSave = async (e) => {
    e.preventDefault();

    if (!name || !host || !user || !remoteLogDir) {
      showToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    let updatedDevices = [...devicesList];
    const devId = deviceModalData.id;

    if (devId) {
      updatedDevices = updatedDevices.map((d) => {
        if (d.id === devId) {
          return {
            ...d,
            name,
            modality,
            brand,
            host,
            port: parseInt(port, 10) || 22,
            user,
            password: password ? password : d.password,
            remoteLogDir,
            sshMode,
            active,
          };
        }
        return d;
      });
    } else {
      updatedDevices.push({
        id: 'ne-' + Date.now(),
        name,
        modality,
        brand,
        host,
        port: parseInt(port, 10) || 22,
        user,
        password,
        remoteLogDir,
        sshMode,
        active,
      });
    }

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationMode,
          refreshInterval,
          devices: updatedDevices,
        }),
      });

      if (res.ok) {
        showToast('Equipo guardado exitosamente', 'success');
        setDeviceModalData(null);
        refreshData();
      } else {
        showToast('Error al guardar el equipo', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar equipo', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setDeviceModalData(null)}>
      <div className="modal-card" style={{ maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {deviceModalData.id ? `Editar Equipo: ${deviceModalData.name}` : 'Añadir Nuevo Equipo SSH'}
            </h3>
          </div>
          <button
            onClick={() => setDeviceModalData(null)}
            className="icon-btn"
            style={{ width: 32, height: 32, borderRadius: 6 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Nombre del Equipo *
                </label>
                <input
                  type="text"
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={modality === 'MRI' ? 'Ej. Resonador 1.5T' : 'Ej. Tomógrafo Sala 1'}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Modalidad *
                </label>
                <select
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={modality}
                  onChange={(e) => {
                    const newMod = e.target.value;
                    setModality(newMod);
                    if (newMod === 'MRI' && remoteLogDir === '/usr/g/service/log') {
                      setRemoteLogDir('/usr/g/service/log');
                    }
                  }}
                >
                  <option value="CT">Tomógrafo (CT)</option>
                  <option value="MRI">Resonador (MRI)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Marca
                </label>
                <select
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option value="GE">GE Healthcare</option>
                  <option value="Siemens">Siemens Healthineers</option>
                  <option value="Philips">Philips Healthcare</option>
                  <option value="Toshiba">Canon / Toshiba</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Host / Dirección IP *
                </label>
                <input
                  type="text"
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="Ej. 192.168.122.80"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Puerto SSH *
                </label>
                <input
                  type="number"
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="22"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Usuario SSH *
              </label>
              <input
                type="text"
                className="glass-input"
                style={{ width: '100%' }}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="sdcp / root"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Contraseña SSH
                </label>
                <input
                  type="password"
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={deviceModalData.id ? 'Omitir si no cambia' : 'Contraseña SSH'}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                  Modo SSH
                </label>
                <select
                  className="glass-input"
                  style={{ width: '100%' }}
                  value={sshMode}
                  onChange={(e) => setSshMode(e.target.value)}
                >
                  <option value="legacy">Legacy (Key Exchange Inseguro)</option>
                  <option value="modern">Moderno (Standard SSH2)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Directorio Remoto de Logs *
              </label>
              <input
                type="text"
                className="glass-input"
                style={{ width: '100%' }}
                value={remoteLogDir}
                onChange={(e) => setRemoteLogDir(e.target.value)}
                placeholder="/usr/g/service/log"
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="chk-device-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label htmlFor="chk-device-active" style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Activar Monitoreo Activo de Logs
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn glass-btn" onClick={() => setDeviceModalData(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn" style={{ background: 'var(--primary)', color: '#000' }}>
              Guardar Equipo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
