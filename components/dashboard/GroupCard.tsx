import React, { useState, useRef, useEffect } from 'react';
import type { Group } from '../../types';

interface GroupCardProps {
  group: Group;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onEdit: () => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onClick, onEdit }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(prev => !prev);
  };
  
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setIsMenuOpen(false);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 h-full flex flex-col"
    >
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start gap-2">
            <div className="flex-grow">
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{group.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {group.participants.length} member{group.participants.length !== 1 ? 's' : ''}
                </p>
            </div>
            <div ref={menuRef} className="relative flex-shrink-0 -mr-2">
                <button onClick={handleMenuClick} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full" aria-label="More options">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                </button>
                {isMenuOpen && (
                    <div 
                        onMouseDown={e => e.stopPropagation()} 
                        onTouchStart={e => e.stopPropagation()} 
                        className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20"
                    >
                        <button onClick={(e) => handleActionClick(e, onEdit)} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">Edit Group</button>
                    </div>
                )}
            </div>
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex -space-x-2 overflow-hidden">
            {group.participants.slice(0, 5).map(p => (
              <div key={p.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-teal-500 flex items-center justify-center text-white font-bold text-xs" title={p.name}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {group.participants.length > 5 && (
              <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs">
                +{group.participants.length - 5}
              </div>
            )}
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">
            {group.participants.length} member{group.participants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GroupCard;