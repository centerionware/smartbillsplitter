import React from 'react';
import type { Participant, SplitMode } from '../types.ts';

interface BillParticipantsProps {
  participants: Participant[];
  setParticipants: (participants: Participant[]) => void;
  splitMode: SplitMode;
  participantsError?: string;
}

const BillParticipants: React.FC<BillParticipantsProps> = ({ participants, setParticipants, splitMode, participantsError }) => {
  
  const handleAddParticipant = () => {
    setParticipants([...participants, { id: `p-${Date.now()}`, name: '', amountOwed: 0, paid: false, splitValue: 0 }]);
  };

  const handleRemoveParticipant = (id: string) => {
    if (participants.length > 1) {
        setParticipants(participants.filter(p => p.id !== id));
    }
  };
  
  const handleParticipantChange = (id: string, field: 'name' | 'splitValue', value: string) => {
    const newParticipants = participants.map(p => {
        if (p.id === id) {
            if (field === 'name') {
                return { ...p, name: value };
            }
            const numericValue = parseFloat(value) || 0;
            return { ...p, splitValue: numericValue };
        }
        return p;
    });
    setParticipants(newParticipants);
  };
  
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Participants</h3>
      <div className="space-y-3">
          {participants.map((p, index) => (
              <div key={p.id} className="flex items-center gap-2">
                  <input type="text" value={p.name} onChange={e => handleParticipantChange(p.id, 'name', e.target.value)} placeholder={`Participant ${index + 1}`} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                  {(splitMode === 'amount' || splitMode === 'percentage') && (
                      <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">{splitMode === 'amount' ? '$' : '%'}</span>
                          <input type="number" step="0.01" value={p.splitValue || ''} onChange={e => handleParticipantChange(p.id, 'splitValue', e.target.value)} className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                      </div>
                  )}
                  <button onClick={() => handleRemoveParticipant(p.id)} disabled={participants.length <= 1} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg></button>
              </div>
          ))}
          <button onClick={handleAddParticipant} className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
              <span>Add Participant</span>
          </button>
          {participantsError && <p className="text-sm text-red-500">{participantsError}</p>}
      </div>
    </div>
  );
};

export default BillParticipants;
