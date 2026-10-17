import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  count?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width, height, circle, className = '', count = 1, style: customStyle }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width,
    height: height,
    borderRadius: circle ? '50%' : '2px',
    ...customStyle,
  };

  const skeletons = Array.from({ length: count }).map((_, i) => (
    <div 
      key={i} 
      className={`skeleton-base ${className}`} 
      style={style}
    />
  ));

  return <>{skeletons}</>;
}

export function CardSkeleton() {
  return (
    <div className="glass-surface skeleton-card">
      <div className="skeleton-card-header">
        <Skeleton width="40%" height={12} />
      </div>
      <div className="skeleton-card-body">
        <Skeleton width="80%" height={24} style={{ marginBottom: '12px' }} />
        <Skeleton width="100%" height={8} count={3} className="mb-2" />
      </div>
    </div>
  );
}
