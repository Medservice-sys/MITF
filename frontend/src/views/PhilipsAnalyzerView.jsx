import React, { useState, useRef } from 'react';
import { UploadCloud, FileSearch, CheckCircle2, AlertCircle, FileArchive } from 'lucide-react';
import { DiagnosticReport } from '../components/DiagnosticReport';

export const PhilipsAnalyzerView = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', null
  const [reportData, setReportData] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = function (e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    // Validate file type (tar, tar.gz, zip)
    const validExtensions = ['.tar', '.gz', '.zip'];
    const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (isValid) {
      setSelectedFile(file);
      setUploadStatus(null);
    } else {
      alert("Por favor selecciona un archivo comprimido válido (.tar, .tar.gz, .zip)");
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/logs/philips/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      setReportData(data);
      setUploadStatus('success');
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadStatus(null);
    setReportData(null);
  };

  if (uploadStatus === 'success' && reportData) {
    return (
      <div className="view-container">
        <DiagnosticReport reportData={reportData} onNewUpload={handleReset} />
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Analizador Inteligente Philips CT</h2>
          <p className="subtitle">
            Carga el archivo Bug Report extraído del equipo para obtener un diagnóstico asistido.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '800px', margin: '0 auto', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UploadCloud /> Ingesta de Datos
        </h3>

        <div
          className={`upload-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border)',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            backgroundColor: dragActive ? 'rgba(0, 210, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            boxShadow: dragActive ? '0 0 20px rgba(0, 210, 255, 0.2)' : 'none',
            position: 'relative'
          }}
          onClick={onButtonClick}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".tar,.gz,.zip"
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <FileArchive
              style={{
                width: 56,
                height: 56,
                color: dragActive ? 'var(--primary)' : 'var(--text-muted)',
                marginBottom: '1.5rem',
                transform: dragActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}
            />
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: dragActive ? 'var(--primary)' : 'var(--text-main)' }}>
              Arrastra tu archivo aquí o haz clic para buscar
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Soporta formatos .tar, .tar.gz generados por la herramienta de servicio Philips.
            </p>
          </div>
        </div>

        {selectedFile && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--bg-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <FileSearch style={{ color: 'var(--primary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{selectedFile.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={(e) => { e.stopPropagation(); handleUpload(); }}
              disabled={isUploading}
            >
              {isUploading ? 'Procesando...' : 'Analizar Archivo'}
            </button>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(0, 255, 136, 0.1)', color: 'var(--success)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 /> <span>Archivo procesado con éxito. Generando reporte...</span>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(255, 51, 102, 0.1)', color: 'var(--critical)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle /> <span>Error al procesar el archivo. Verifica el formato.</span>
          </div>
        )}
      </div>
    </div>
  );
};
