import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        let icon = <Info style={{ width: 18, height: 18, color: 'var(--info)' }} />;
        let toastClass = 'toast-info';

        if (toast.type === 'success') {
          icon = <CheckCircle2 style={{ width: 18, height: 18, color: 'var(--secondary)' }} />;
          toastClass = 'toast-success';
        } else if (toast.type === 'error') {
          icon = <AlertCircle style={{ width: 18, height: 18, color: 'var(--critical)' }} />;
          toastClass = 'toast-error';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle style={{ width: 18, height: 18, color: 'var(--warning)' }} />;
          toastClass = 'toast-warning';
        }

        return (
          <div key={toast.id} className={`toast ${toastClass}`}>
            {icon}
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};
