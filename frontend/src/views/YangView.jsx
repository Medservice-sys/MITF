import React, { useState } from 'react';
import { GitFork, ChevronRight, ChevronDown, Folder, FileCode } from 'lucide-react';

const yangTreeData = {
  name: 'mitf-tom-telemetry',
  type: 'module',
  children: [
    {
      name: 'system-identity',
      type: 'container',
      children: [
        { name: 'model-name', type: 'leaf', value: 'GE LightSpeed VCT' },
        { name: 'serial-number', type: 'leaf', value: 'CT-984321-GE' },
        { name: 'firmware-version', type: 'leaf', value: 'v26.4.102-GE' },
      ],
    },
    {
      name: 'subsystems-health',
      type: 'container',
      children: [
        {
          name: 'tube',
          type: 'container',
          children: [
            { name: 'mas-accumulated', type: 'leaf', value: '7,478,990 mAs' },
            { name: 'thermal-heat-percent', type: 'leaf', value: '14.2%' },
            { name: 'filament-temperature', type: 'leaf', value: 'Normal (1,850 °C)' },
          ],
        },
        {
          name: 'gantry',
          type: 'container',
          children: [
            { name: 'rotations-total', type: 'leaf', value: '45,210 revs' },
            { name: 'slip-ring-wear', type: 'leaf', value: 'Ok (2.1%)' },
          ],
        },
        {
          name: 'cooling',
          type: 'container',
          children: [
            { name: 'chiller-status', type: 'leaf', value: 'ACTIVE' },
            { name: 'flow-rate-lpm', type: 'leaf', value: '12.4 L/min' },
          ],
        },
      ],
    },
    {
      name: 'data-acquisition',
      type: 'container',
      children: [
        { name: 'sampling-frequency-khz', type: 'leaf', value: '500 kHz' },
        { name: 'active-channels', type: 'leaf', value: '64 Slices' },
      ],
    },
  ],
};

const TreeNode = ({ node, defaultExpand }) => {
  const [isOpen, setIsOpen] = useState(defaultExpand);

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: 18, marginTop: 4 }}>
      <div
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 6,
          cursor: hasChildren ? 'pointer' : 'default',
          fontSize: '0.85rem',
          fontFamily: 'var(--font-mono)',
        }}
        className="tree-node-content"
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown style={{ width: 14, height: 14, color: 'var(--primary)' }} />
          ) : (
            <ChevronRight style={{ width: 14, height: 14, color: 'var(--primary)' }} />
          )
        ) : (
          <FileCode style={{ width: 14, height: 14, color: 'var(--text-dim)' }} />
        )}

        {hasChildren ? (
          <Folder style={{ width: 14, height: 14, color: 'var(--warning)' }} />
        ) : null}

        <span style={{ fontWeight: hasChildren ? 700 : 500, color: hasChildren ? 'var(--primary)' : 'var(--text-main)' }}>
          {node.name}
        </span>

        <span
          style={{
            fontSize: '0.7rem',
            background: 'rgba(255,255,255,0.06)',
            padding: '1px 5px',
            borderRadius: 4,
            color: 'var(--text-dim)',
          }}
        >
          {node.type}
        </span>

        {node.value !== undefined && (
          <span style={{ color: 'var(--secondary)', marginLeft: 8, fontWeight: 600 }}>
            = {node.value}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div style={{ borderLeft: '1px dashed rgba(255,255,255,0.15)', marginLeft: 10 }}>
          {node.children.map((child, idx) => (
            <TreeNode key={idx} node={child} defaultExpand={defaultExpand} />
          ))}
        </div>
      )}
    </div>
  );
};

export const YangView = () => {
  const [expandAllKey, setExpandAllKey] = useState(0);
  const [expandState, setExpandState] = useState(true);

  const toggleExpandAll = (state) => {
    setExpandState(state);
    setExpandAllKey((prev) => prev + 1);
  };

  return (
    <div className="yang-view">
      <div className="glass-panel" style={{ padding: 20 }}>
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitFork style={{ width: 22, height: 22, color: 'var(--primary)' }} />
            <h3>Árbol Data Model YANG - mitf-tom-telemetry</h3>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn glass-btn" onClick={() => toggleExpandAll(true)}>
              Expandir Todo
            </button>
            <button className="btn glass-btn" onClick={() => toggleExpandAll(false)}>
              Colapsar Todo
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <TreeNode key={expandAllKey} node={yangTreeData} defaultExpand={expandState} />
        </div>
      </div>
    </div>
  );
};
