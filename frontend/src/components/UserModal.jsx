import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, UserCheck } from 'lucide-react';

export const UserModal = ({ onSaved }) => {
  const { userModalData, setUserModalData, devicesList, showToast } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('operator');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    if (userModalData && typeof userModalData === 'object' && userModalData.id) {
      setUsername(userModalData.username || '');
      setPassword('');
      setFullName(userModalData.fullName || '');
      setRole(userModalData.role || 'operator');
      setDeviceId(userModalData.deviceId || '');
    } else {
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('operator');
      setDeviceId('');
    }
  }, [userModalData]);

  if (!userModalData) return null;

  const handleSave = async (e) => {
    e.preventDefault();

    if (!username || !fullName) {
      showToast('Por favor complete el nombre de usuario y el nombre completo', 'warning');
      return;
    }

    if (!userModalData.id && !password) {
      showToast('La contraseña es requerida para un nuevo usuario', 'warning');
      return;
    }

    const payload = {
      username,
      fullName,
      role,
      deviceId,
    };
    if (password) payload.password = password;

    try {
      let url = '/api/users';
      let method = 'POST';

      if (userModalData.id) {
        url = `/api/users/${userModalData.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Usuario guardado exitosamente', 'success');
        setUserModalData(null);
        if (onSaved) onSaved();
      } else {
        const txt = await res.text();
        showToast(`Error al guardar usuario: ${txt}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al guardar usuario', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setUserModalData(null)}>
      <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCheck style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {userModalData.id ? `Editar Usuario: ${userModalData.username}` : 'Añadir Nuevo Usuario'}
            </h3>
          </div>
          <button
            onClick={() => setUserModalData(null)}
            className="icon-btn"
            style={{ width: 32, height: 32, borderRadius: 6 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Usuario (Login) *
              </label>
              <input
                type="text"
                className="glass-input"
                style={{ width: '100%' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. operario1 / ing_campo"
                disabled={!!userModalData.id}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Nombre Completo *
              </label>
              <input
                type="text"
                className="glass-input"
                style={{ width: '100%' }}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ej. Juan Pérez"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Contraseña {userModalData.id && '(Omitir si no desea cambiarla)'}
              </label>
              <input
                type="password"
                className="glass-input"
                style={{ width: '100%' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required={!userModalData.id}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Rol de Acceso
              </label>
              <select
                className="glass-input"
                style={{ width: '100%' }}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="operator">Operario (Solo lectura & apertura tickets)</option>
                <option value="engineer">Ingeniero de Campo (Resolución tickets)</option>
                <option value="admin">Administrador (Acceso total & configuración)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
                Equipo Asignado Preferente (Opcional)
              </label>
              <select
                className="glass-input"
                style={{ width: '100%' }}
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <option value="">-- Todos los equipos --</option>
                {devicesList.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name} ({dev.host})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn glass-btn" onClick={() => setUserModalData(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn" style={{ background: 'var(--primary)', color: '#000' }}>
              Guardar Usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
