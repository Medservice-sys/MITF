import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Activity, Lock, User } from 'lucide-react';

export const LoginOverlay = () => {
  const { isAuthenticated, login } = useAuth();
  const { refreshData } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const res = await login(username, password);
    setIsLoading(false);

    if (res.success) {
      refreshData();
    } else {
      setErrorMsg(res.error || 'Usuario o contraseña incorrectos');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(10, 14, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '90%',
          maxWidth: 420,
          padding: '36px 30px',
          textAlign: 'center',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Activity style={{ width: 36, height: 36, color: 'var(--primary)' }} />
          <h2
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            MITF - TOM
          </h2>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', marginBottom: 24 }}>
          Sistema de Telemetría y Monitoreo de Tomógrafos GE CT
        </p>

        {errorMsg && (
          <div
            style={{
              background: 'rgba(255, 75, 43, 0.15)',
              border: '1px solid rgba(255, 75, 43, 0.3)',
              color: '#ff6b52',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.82rem',
              marginBottom: 16,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <User
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="text"
              className="glass-input"
              style={{ width: '100%', paddingLeft: 36 }}
              placeholder="Usuario (ej. admin / operario)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="password"
              className="glass-input"
              style={{ width: '100%', paddingLeft: 36 }}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, var(--primary), #0099ff)',
              color: '#000',
              fontWeight: 700,
              padding: '10px 0',
              fontSize: '0.95rem',
              marginTop: 10,
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          Ingeniería Médica &bull; GE LightSpeed CT Monitor v1.2
        </div>
      </div>
    </div>
  );
};
