import React, { useState } from 'react';
import { type WidgetInstance, WIDGET_REGISTRY } from './widgetTypes';
import { useWidgetStore } from './useWidgetStore';
import './WidgetContainer.css';

interface WidgetContainerProps {
  widget: WidgetInstance;
  children: React.ReactNode;
  onConfigChange?: (config: Record<string, any>) => void;
}

export function WidgetContainer({ widget, children, onConfigChange }: WidgetContainerProps) {
  const { moveWidget, toggleCollapse, updateWidgetConfig } = useWidgetStore();
  const meta = WIDGET_REGISTRY[widget.type];
  
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(widget.title);

  const handleSaveTitle = () => {
    updateWidgetConfig(widget.id, { title: tempTitle });
    setIsEditing(false);
  };

  return (
    <div className={`widget-container glass-surface ${widget.collapsed ? 'is-collapsed' : ''}`}>
      {/* Widget Header */}
      <div className="widget-header">
        <div className="widget-header-left">
          <div className="widget-reorder-btns">
            <button 
              className="widget-order-btn" 
              onClick={() => moveWidget(widget.id, 'up')}
              aria-label="Move widget up"
              title="Move Up"
            >
              <span className="material-symbols-outlined icon-xs">arrow_upward</span>
            </button>
            <button 
              className="widget-order-btn" 
              onClick={() => moveWidget(widget.id, 'down')}
              aria-label="Move widget down"
              title="Move Down"
            >
              <span className="material-symbols-outlined icon-xs">arrow_downward</span>
            </button>
          </div>

          <span className="material-symbols-outlined widget-type-icon">{meta?.icon || 'widgets'}</span>

          {isEditing ? (
            <div className="widget-title-edit-wrap">
              <input
                className="widget-title-input"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                autoFocus
              />
              <button className="widget-save-btn" onClick={handleSaveTitle}>
                SAVE
              </button>
            </div>
          ) : (
            <div className="widget-title-wrap" onClick={() => toggleCollapse(widget.id)}>
              <span className="widget-title-text">{widget.title}</span>
              {meta?.inputs && (
                <span className="widget-pipeline-badge in" title="Receives data from other widgets">
                  IN: {meta.inputs[0]}
                </span>
              )}
              {meta?.outputs && (
                <span className="widget-pipeline-badge out" title="Provides data to pipeline">
                  OUT: {meta.outputs[0]}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="widget-header-right">
          <button 
            className={`widget-tool-btn ${isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
            title="Configure / Edit Widget"
          >
            <span className="material-symbols-outlined icon-xs">
              {isEditing ? 'close' : 'tune'}
            </span>
            <span className="btn-label-text">{isEditing ? 'DONE' : 'EDIT'}</span>
          </button>

          <button 
            className="widget-tool-btn collapse-toggle"
            onClick={() => toggleCollapse(widget.id)}
            title={widget.collapsed ? 'Expand' : 'Collapse'}
          >
            <span className="material-symbols-outlined icon-xs">
              {widget.collapsed ? 'expand_more' : 'expand_less'}
            </span>
          </button>
        </div>
      </div>

      {/* In-Place Config Drawer */}
      {isEditing && (
        <div className="widget-config-drawer">
          <div className="config-drawer-row">
            <span className="text-label-mono-sm color-muted">WIDGET_CONFIG</span>
            <span className="text-label-mono-sm color-positive">PLUG_&_PLAY</span>
          </div>

          <div className="config-drawer-controls">
            <label className="config-label">
              <span>Custom Title</span>
              <input 
                className="config-input" 
                value={tempTitle} 
                onChange={e => setTempTitle(e.target.value)} 
              />
            </label>

            <div className="config-pipeline-info">
              <span className="pipeline-title">Data Pipeline Connections:</span>
              <div className="pipeline-chips">
                {meta?.inputs?.map(inp => (
                  <span key={inp} className="pipeline-chip in">← {inp}</span>
                ))}
                {meta?.outputs?.map(out => (
                  <span key={out} className="pipeline-chip out">→ {out}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget Body */}
      {!widget.collapsed && (
        <div className="widget-body">
          {children}
        </div>
      )}
    </div>
  );
}
