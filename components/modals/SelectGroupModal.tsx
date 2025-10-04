import React, { useState, useMemo, useCallback } from 'react';
import type { Group } from '../../types';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

const GROUPS_PER_PAGE = 5;

interface SelectGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groups: Group[];
    onSelect: (groupId: string) => void;
}

const SelectGroupModal: React.FC<SelectGroupModalProps> = ({ isOpen, onClose, groups, onSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(GROUPS_PER_PAGE);

    const sortedAndFilteredGroups = useMemo(() => {
        const lowercasedQuery = searchQuery.toLowerCase();
        return [...groups]
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.name.localeCompare(b.name))
            .filter(group => group.name.toLowerCase().includes(lowercasedQuery));
    }, [groups, searchQuery]);

    const visibleGroups = useMemo(() => {
        return sortedAndFilteredGroups.slice(0, visibleCount);
    }, [sortedAndFilteredGroups, visibleCount]);

    const hasMore = visibleCount < sortedAndFilteredGroups.length;

    const loadMore = useCallback(() => {
        if (hasMore) {
            setVisibleCount(prev => prev + GROUPS_PER_PAGE);
        }
    }, [hasMore]);

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
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 id="select-group-title" className="sr-only">Select a Group</h2>
                    <input 
                        type="text"
                        placeholder="Search groups..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                        autoFocus
                    />
                </div>
                <ul className="flex-grow overflow-y-auto p-4 space-y-2">
                    {visibleGroups.map((group, index) => {
                        const isLastElement = index === visibleGroups.length - 1;
                        return (
                            <li key={group.id} ref={isLastElement && hasMore ? loadMoreRef : null}>
                                <button 
                                    onClick={() => onSelect(group.id)}
                                    className="w-full text-left p-4 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{group.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{group.participants.length} members</p>
                                </button>
                            </li>
                        );
                    })}
                    {hasMore && (
                        <li className="text-center p-4 text-slate-500 dark:text-slate-400">Loading more...</li>
                    )}
                     {!sortedAndFilteredGroups.length && (
                        <li className="text-center p-8 text-slate-500 dark:text-slate-400">
                            {searchQuery ? 'No groups match your search.' : 'No groups found.'}
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default SelectGroupModal;