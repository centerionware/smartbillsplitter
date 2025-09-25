import React from 'react';

interface EmptyStateProps {
  title: string;
  message: string;
  isArchiveContext?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, message, isArchiveContext = false }) => {
  const icon = isArchiveContext ? (
    <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
  ) : (
    <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
  );

  return (
    <div className="text-center py-16 px-6 bg-white dark:bg-slate-800 rounded-lg shadow">
      {icon}
      <h3 className="mt-2 text-xl font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
};

export default EmptyState;
