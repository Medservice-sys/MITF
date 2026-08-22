import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Save, BookOpen, Wrench } from 'lucide-react';

export const HelpModal = () => {
  const { helpCode, setHelpCode, showToast } = useApp();
  const [theoryText, setTheoryText] = useState('Cargando manuales técnicos...');
  const [practiceText, setPracticeText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!helpCode) return;
    setTheoryText('Buscando manuales técnicos en la base de conocimientos...');
    setPracticeText('');

    fetch('/api/knowledge')
      .then((res) => (res.ok ? res.json() : {}))
      .then((kb) => {
        const entry = kb[helpCode];
        if (entry) {
          setTheoryText(entry.theory || 'No hay descripción teórica registrada en el manual de servicio.');
          setPracticeText(entry.practice || '');
        } else {
          setTheoryText(
            'Este código de evento no cuenta con definición teórica en los manuales de servicio cargados. Puedes registrar la experiencia técnica abajo.'
          );
        }
      })
      .catch((err) => {
        console.error('Error fetching knowledge base:', err);
        setTheoryText('Error al cargar la información del servidor.');
      });
  }, [helpCode]);

  if (!helpCode) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: helpCode,
          practice: practiceText,
        }),
      });

      if (res.ok) {
        showToast('Experiencia técnica guardada con éxito.', 'success');
        setHelpCode(null);
      } else {
        showToast('Error al guardar la experiencia', 'error');
      }
    } catch (err) {
      console.error('Save knowledge failed:', err);
      showToast('Error de conexión', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 650 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Ayuda Técnica - Código: {helpCode}</h3>
          </div>
          <button
            onClick={() => setHelpCode(null)}
            className="icon-btn"
            style={{ width: 32, height: 32, borderRadius: 6 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="modal-body">
          <div>
            <label
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-dim)',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <BookOpen style={{ width: 14, height: 14, color: 'var(--info)' }} /> Manual Técnico / Teoría de Falla
            </label>
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: 14,
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                color: 'var(--text-main)',
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              {theoryText}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-dim)',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Wrench style={{ width: 14, height: 14, color: 'var(--warning)' }} /> Experiencia Práctica de Campo
            </label>
            <textarea
              className="glass-input"
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-ui)' }}
              placeholder="Describa la solución técnica en campo, causas raíz o recomendaciones para futuros ingenieros..."
              value={practiceText}
              onChange={(e) => setPracticeText(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn glass-btn" onClick={() => setHelpCode(null)}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{
              background: 'var(--primary)',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save style={{ width: 16, height: 16 }} />
            <span>{isSaving ? 'Guardando...' : 'Guardar Experiencia'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
