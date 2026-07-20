import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UploadCloud, CheckCircle2, FileText } from 'lucide-react';

export const FtpView = () => {
  const { showToast, refreshData } = useApp();

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast('Seleccione un archivo de log para ingestión', 'warning');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('logFile', selectedFile);

    try {
      const res = await fetch('/api/admin/ftp-upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        showToast(`Archivo ${selectedFile.name} ingestado correctamente`, 'success');
        setSelectedFile(null);
        setFileContent('');
        refreshData();
      } else {
        showToast('Error en la ingestión del archivo', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al subir archivo', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="ftp-view">
      {/* Watcher status card */}
      <div className="glass-panel" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <UploadCloud style={{ width: 28, height: 28, color: 'var(--primary)' }} />
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Servicio Watcher FTP / Ingesta de Logs</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              Directorio Monitoreado: <code>/var/ftp/mitf_logs/</code> &bull; Polling cada 30 segundos
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dot dot-green"></span>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--secondary)' }}>Watcher Activo</span>
        </div>
      </div>

      {/* Manual Upload box */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14 }}>Carga Manual de Archivo de Log GE CT (.log / .txt)</h4>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <input
            type="file"
            accept=".log,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="ftp-file-input"
          />

          <label htmlFor="ftp-file-input" className="btn glass-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <FileText style={{ width: 16, height: 16 }} />
            <span>{selectedFile ? selectedFile.name : 'Seleccionar Archivo de Log'}</span>
          </label>

          {selectedFile && (
            <button
              className="btn"
              style={{ background: 'var(--primary)', color: '#000', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={handleUpload}
              disabled={isUploading}
            >
              <UploadCloud style={{ width: 16, height: 16 }} />
              <span>{isUploading ? 'Ingestando...' : 'Iniciar Ingestión'}</span>
            </button>
          )}
        </div>

        {fileContent && (
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 6, display: 'block' }}>
              Vista Previa del Archivo de Log:
            </label>
            <pre
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: 14,
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
                maxHeight: 250,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {fileContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
