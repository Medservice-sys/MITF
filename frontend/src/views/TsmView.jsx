import React from 'react';
import { Boxes } from 'lucide-react';

const tsmCatalog = [
  { id: 'TUBE', name: 'Tubo de Rayos X (X-Ray Tube)', desc: 'Generación de haz fotónico de alta energía mAs/kV. Monitor de temperatura del ánodo, filamentos y aceite.' },
  { id: 'HV_GENERATOR', name: 'Generador de Alta Tensión (HV Generator)', desc: 'Inversor de potencia y transformador elevador kVp. Control de disparo de disparo de disparador.' },
  { id: 'DAS', name: 'Sistema de Adquisición de Datos (DAS)', desc: 'Conversión A/D multicanal ultra rápida y transmisión de señales fotónicas por anillo deslizante.' },
  { id: 'GANTRY', name: 'Estructura Rotatoria Gantry', desc: 'Rotor, rodamientos, anillo deslizante (slip ring), encoder óptico de posicionamiento angular.' },
  { id: 'COOLING', name: 'Unidad de Enfriamiento (Cooling Chiller)', desc: 'Intercambiador de calor agua/aceite, bomba de circulación, presostato y sensores térmicos.' },
  { id: 'COLLIMATOR', name: 'Colimador Pré/Pós Paciente', desc: 'Aperturas mecánicas asistidas por motores paso a paso para definición de espesor de corte de haz.' },
  { id: 'TGP', name: 'Procesador de Geometría (TGP)', desc: 'Cálculos síncronos de posición geométrica de corte y corrección de movimiento.' },
  { id: 'OBC', name: 'Ordenador de Bordo de Consola (OBC)', desc: 'Host de control operacional, bus VME/PCIe de comunicación en consola principal.' },
  { id: 'RCIB', name: 'Interfaz de Control de Reconstrucción (RCIB)', desc: 'Controlador de bus de transferencia rápida de proyecciones hacia el sistema de reconstrucción.' },
  { id: 'TABLE', name: 'Mesa de Exploración del Paciente', desc: 'Motor de desplazamiento longitudinal (Z-axis) y elevación vertical. Freno electromagnético.' },
  { id: 'CONSOLE', name: 'Consola del Operador', desc: 'Interfaz de usuario, monitor médico, intercomunicador y software de exploración scanmgr.' },
];

export const TsmView = () => {
  return (
    <div className="tsm-view">
      <div className="table-box glass-panel">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Boxes style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Taxonomía de Mantenimiento TSM - Subsistemas Físicos GE LightSpeed CT</h3>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="glass-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Código Subsistema</th>
                <th>Denominación del Componente</th>
                <th>Descripción Funcional & Telemetría Asociada</th>
              </tr>
            </thead>
            <tbody>
              {tsmCatalog.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                    {item.id}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.name}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
