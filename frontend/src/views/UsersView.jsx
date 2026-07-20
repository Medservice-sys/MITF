import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserCheck, Plus, Edit, Trash2 } from 'lucide-react';
import { UserModal } from '../components/UserModal';

export const UsersView = () => {
  const { setUserModalData, showToast } = useApp();
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`¿Está seguro de eliminar el usuario '${username}'?`)) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Usuario ${username} eliminado`, 'success');
        fetchUsers();
      } else {
        const txt = await res.text();
        showToast(`Error al eliminar: ${txt}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  return (
    <div className="users-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCheck style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Gestión de Usuarios, Roles & Permisos ({users.length})</h3>
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
            onClick={() => setUserModalData({})}
          >
            <Plus style={{ width: 14, height: 14 }} />
            <span>Nuevo Usuario</span>
          </button>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre Completo</th>
                <th>Rol de Acceso</th>
                <th>Equipo Asignado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                      {u.username}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.fullName}</td>
                    <td>
                      <span
                        className={`pill ${
                          u.role === 'admin'
                            ? 'pill-critical'
                            : u.role === 'engineer'
                            ? 'pill-warning'
                            : 'pill-info'
                        }`}
                      >
                        {u.role === 'admin'
                          ? 'Administrador'
                          : u.role === 'engineer'
                          ? 'Ing. Campo'
                          : 'Operario'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {u.deviceId ? `Equipo #${u.deviceId}` : 'Todos los equipos'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          className="btn glass-btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setUserModalData(u)}
                        >
                          <Edit style={{ width: 12, height: 12 }} />
                        </button>

                        <button
                          className="btn glass-btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--critical)' }}
                          onClick={() => handleDeleteUser(u.id, u.username)}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center" style={{ padding: 20, color: 'var(--text-dim)' }}>
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal onSaved={fetchUsers} />
    </div>
  );
};
