import React, { useState, useMemo, useCallback } from 'react';
import type { Group } from '../../types';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface SelectGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGroup: (groupId: string) => void;
  groups: Group[];
}

const GROUPS_PER_PAGE = 5;

const SelectGroupModal: React.FC<SelectGroupModalProps> = ({ isOpen, onClose, onSelectGroup, groups }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(GROUPS_PER_PAGE);

  const sortedAndFilteredGroups = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    return groups
      .filter(g => g.name.toLowerCase().includes(lowercasedQuery))
      .sort((a, b) => {
        if (b.popularity !== a.popularity) {
          return b.popularity - a.popularity;
        }
        return a.name.localeCompare(b.name);
      });
  }, [groups, searchQuery]);

  const hasMore = visibleCount < sortedAndFilteredGroups.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + GROUPS_PER_PAGE);
    }
  }, [hasMore]);

  // FIX: Specified the element type `HTMLLIElement` for the generic `useIntersectionObserver` hook to ensure the returned ref is correctly typed for an `<li>` element.
  const { ref: loadMoreRef } = useIntersectionObserver<HTMLLIElement>({ onIntersect: loadMore });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-group-title"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 id="select-group-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Select a Group</h2>
        </div>

        <div className="p-4 flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            autoFocus
          />
        </div>

        <div className="px-6 pb-6 flex-grow overflow-y-auto">
          {sortedAndFilteredGroups.length > 0 ? (
            <ul className="space-y-3">
              {sortedAndFilteredGroups.slice(0, visibleCount).map(group => (
                <li key={group.id}>
                  <button 
                    onClick={() => onSelectGroup(group.id)}
                    className="w-full text-left p-4 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{group.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{group.participants.length} members</p>
                  </button>
                </li>
              ))}
              {hasMore && (
                <li ref={loadMoreRef} className="text-center p-4 text-slate-400">
                  Loading...
                </li>
              )}
            </ul>
          ) : (
            <p className="text-center text-slate-500 dark:text-slate-400 pt-8">No groups found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectGroupModal;
