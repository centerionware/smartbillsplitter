import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, label, variant = 'primary' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  const colorClasses = {
    primary: 'bg-teal-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  let effectiveVariant = variant;
  if (variant === 'primary') {
      if (percentage > 95) effectiveVariant = 'danger';
      else if (percentage > 80) effectiveVariant = 'warning';
      else effectiveVariant = 'success';
  }

  return (
    <div>
      {label && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-1">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${colorClasses[effectiveVariant]}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
