import React from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { formatINR, formatINRCompact } from '../lib/currency';

interface CurrencyValueProps {
  paise: number;
  compact?: boolean;
  sign?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function CurrencyValue({ 
  paise, 
  compact = false, 
  sign = false, 
  className = '', 
  style = {} 
}: CurrencyValueProps) {
  const privacyMode = useAppStore((state) => state.privacyMode);

  if (privacyMode) {
    return (
      <span 
        className={`money-hidden ${className}`} 
        style={{ 
          ...style,
          userSelect: 'none',
          filter: 'blur(4px)',
          opacity: 0.8,
          fontFamily: 'monospace'
        }}
        title="Privacy Mode Active"
      >
        ₹XX,XXX.XX
      </span>
    );
  }

  const formatted = compact 
    ? formatINRCompact(paise) 
    : formatINR(paise, { sign });

  return (
    <span className={className} style={style}>
      {formatted}
    </span>
  );
}
