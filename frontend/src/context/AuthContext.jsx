import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => sessionStorage.getItem('currentUser') || null);
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('user-role') || 'operator');
  const [userFullName, setUserFullName] = useState(() => sessionStorage.getItem('user-fullname') || '');
  const [userDeviceId, setUserDeviceId] = useState(() => sessionStorage.getItem('user-device-id') || '');

  const login = async (username, password) => {
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        return { success: false, error: 'Credenciales inválidas' };
      }

      const data = await res.json();
      if (data.success && data.user) {
        sessionStorage.setItem('currentUser', data.user.username);
        sessionStorage.setItem('user-role', data.user.role);
        sessionStorage.setItem('user-fullname', data.user.fullName || data.user.username);
        sessionStorage.setItem('user-device-id', data.user.deviceId || '');

        setCurrentUser(data.user.username);
        setUserRole(data.user.role);
        setUserFullName(data.user.fullName || data.user.username);
        setUserDeviceId(data.user.deviceId || '');

        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Error en autenticación' };
      }
    } catch (err) {
      console.error('Login failed:', err);
      return { success: false, error: 'Error de conexión con el servidor' };
    }
  };

  const logout = () => {
    sessionStorage.clear();
    setCurrentUser(null);
    setUserRole('operator');
    setUserFullName('');
    setUserDeviceId('');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userRole,
        userFullName,
        userDeviceId,
        isAuthenticated: !!currentUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
