import React from 'react';

interface FinSathiLogoProps {
  size?: number | string;
  className?: string;
  color?: string;
  glow?: boolean;
  style?: React.CSSProperties;
}

export const FinSathiLogo: React.FC<FinSathiLogoProps> = ({
  size = 24,
  className = '',
  color = '#51a85f',
  glow = false,
  style = {}
}) => {
  const glowStyle: React.CSSProperties = glow
    ? {
        filter: 'drop-shadow(0 0 6px rgba(81, 168, 95, 0.45)) drop-shadow(0 0 12px rgba(81, 168, 95, 0.25))',
      }
    : {};

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 220"
      width={size}
      height={size}
      className={`finsathi-logo ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...glowStyle,
        ...style
      }}
      aria-label="FinSathi Logo"
      role="img"
    >
      <path
        fill={color}
        d="M109.66,81.8l19.62,19.16,8.7-8.92-28.77-27.92-61.55,61.39h0s-14.99-14.72-14.99-14.72L109.67,33.5l43.56,43.46,9.01-8.81L109.68,15.48c-.68,2.4-93.88,95.68-93.88,95.68l23.19,23h0s-13.29,13.23-13.29,13.23l8.73,9.22,75.23-74.82Z"
      />
      <polygon
        fill={color}
        points="180.67 86.1 194.73 70.86 185.84 62.47 109.68 138.74 90.76 119.66 81.88 128.75 109.72 156.51 171.28 95.05 186.06 110.5 109.67 186.72 66.34 143.56 57.31 152.28 109.66 204.52 204.21 110.21 180.67 86.1"
      />
    </svg>
  );
};

export default FinSathiLogo;
