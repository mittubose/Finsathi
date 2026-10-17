import React from 'react';
import './Skeletons.css';

// ============ Base Shimmer Bone ============
interface BoneProps {
  width?: string;
  height?: string;
  className?: string;
  style?: React.CSSProperties;
}

function Bone({ width = '100%', height = '12px', className = '', style }: BoneProps) {
  return (
    <div className={`skeleton-bone ${className}`} style={{ width, height, ...style }} />
  );
}

// ============ Card Skeleton ============
// Matches the glass-surface card pattern used in Dashboard widgets
export function CardSkeleton() {
  return (
    <div className="glass-surface skeleton-card">
      <div className="skeleton-card-header glass-card-header">
        <Bone width="120px" height="10px" />
        <Bone width="16px" height="16px" />
      </div>
      <div className="skeleton-card-body">
        <Bone width="80px" height="28px" className="skeleton-bone--bright" />
        <div style={{ marginTop: '12px' }}>
          <Bone width="60%" height="8px" />
          <Bone width="40%" height="8px" style={{ marginTop: '6px' }} />
          <Bone width="75%" height="8px" style={{ marginTop: '6px' }} />
        </div>
      </div>
    </div>
  );
}

// ============ Row Skeleton ============
// Matches the glass-row transaction row pattern in Ledger & Activity
export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-row-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-row skeleton-row">
          <div className="skeleton-row-icon">
            <Bone width="24px" height="24px" />
          </div>
          <div className="skeleton-row-content">
            <Bone width="40%" height="11px" />
            <Bone width="25%" height="9px" style={{ marginTop: '5px' }} />
          </div>
          <div className="skeleton-row-amount">
            <Bone width="70px" height="11px" />
            <Bone width="50px" height="9px" style={{ marginTop: '5px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Table Skeleton ============
// Matches the DataTable header + rows pattern
export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table">
      {/* Header */}
      <div className="skeleton-table-header">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} width={i === 1 ? '40%' : '15%'} height="9px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-table-row glass-row">
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} width={j === 1 ? '60%' : '70%'} height="10px" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============ Form Skeleton ============
// Matches the ledger inline form grid
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="glass-surface-elevated skeleton-form">
      <div className="glass-card-header">
        <Bone width="100px" height="9px" />
      </div>
      <div className="skeleton-form-grid">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="skeleton-form-field">
            <Bone width="60px" height="9px" />
            <Bone width="100%" height="32px" className="skeleton-bone--bright" style={{ marginTop: '4px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Hero Skeleton ============
// Matches the dashboard hero panel
export function HeroSkeleton() {
  return (
    <div className="glass-surface skeleton-hero">
      <div>
        <Bone width="80px" height="9px" />
        <Bone width="180px" height="36px" className="skeleton-bone--bright" style={{ marginTop: '6px' }} />
      </div>
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <Bone width="100px" height="9px" />
          <Bone width="30px" height="9px" />
        </div>
        <div style={{ display: 'flex', gap: '2px', height: '4px' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton-bone" style={{ flex: 1, height: '4px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
