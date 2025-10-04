import React from 'react';
import type { Group } from '../../types';
import type { ParticipantData } from '../ParticipantList';

interface GroupRemindersModalProps {
  group: Group;
  participantsWithDebt: ParticipantData[];
  onClose: () => void;
  onRemind: (participant: ParticipantData) => void;
}

const GroupRemindersModal: React.FC<GroupRemindersModalProps> = ({ group, participantsWithDebt, onClose, onRemind }) => {
  const debtMap = new Map(participantsWithDebt.map(p => [p.name, p]));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Remind Group Members</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Send reminders for outstanding balances across all bills.</p>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <ul className="space-y-3">
            {group.participants.map(p => {
              const debtInfo = debtMap.get(p.name);
              const hasDebt = debtInfo && debtInfo.type === 'owed' && debtInfo.amount > 0;
              return (
                <li key={p.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs">{p.name.charAt(0)}</div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                  </div>
                  {hasDebt ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Owes ${debtInfo.amount.toFixed(2)}</span>
                        <button onClick={() => onRemind(debtInfo)} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-teal-500 text-white hover:bg-teal-600">
                            Remind
                        </button>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">All settled</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupRemindersModal;