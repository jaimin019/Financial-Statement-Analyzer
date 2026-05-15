import React from 'react';

export default function BrandLockup() {
  return (
    <div className="brand-lockup">
      <div className="brand-icon">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div className="brand-text">
        <span className="brand-name">FinSight</span>
        <span className="brand-ai"> AI</span>
      </div>
    </div>
  );
}
