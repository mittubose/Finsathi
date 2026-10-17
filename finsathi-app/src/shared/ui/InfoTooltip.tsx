import React, { useState } from 'react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  title: string;
  description: string;
  dateContext?: string;
  example?: string;
  iconSize?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  title, 
  description, 
  dateContext, 
  example, 
  iconSize = '14px' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="info-tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      <span 
        className="material-symbols-outlined info-tooltip-icon" 
        style={{ fontSize: iconSize }}
      >
        info
      </span>
      
      {isVisible && (
        <div className="info-tooltip-popover">
          <div className="info-tooltip-header">{title}</div>
          <div className="info-tooltip-body">
            <p className="info-tooltip-desc">{description}</p>
            {dateContext && (
              <div className="info-tooltip-section">
                <span className="info-tooltip-label">Dates Considered: </span>
                {dateContext}
              </div>
            )}
            {example && (
              <div className="info-tooltip-section">
                <span className="info-tooltip-label">Example: </span>
                {example}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
