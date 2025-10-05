import React, { useState, useEffect } from 'react';
import type { Participant, SplitMode } from '../types';

interface BillParticipantsProps {
  participants: Participant[];
  setParticipants: (participants: Participant[]) => void;
  splitMode: SplitMode;
  participantsError?: string;
}

const BillParticipants: React.FC<BillParticipantsProps> = ({ participants, setParticipants, splitMode, participantsError }) => {
  const [isContactsApiSupported, setIsContactsApiSupported] = useState(false);

  useEffect(() => {
    if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
      setIsContactsApiSupported(true);
    }
  }, []);
  
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
  
  const handleAddFromContacts = async () => {
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel'], { multiple: true });
      if (contacts.length === 0) return;

      const existingNamesLower = new Set(participants.map(p => p.name.toLowerCase().trim()));
      
      const newParticipantsFromContacts: Participant[] = contacts
        .map((contact: { name: string[], email: string[], tel: string[] }) => {
          const name = contact.name && contact.name.length > 0 ? contact.name[0] : null;
          const email = contact.email && contact.email.length > 0 ? contact.email[0] : null;
          const phone = contact.tel && contact.tel.length > 0 ? contact.tel[0] : null;

          if (name && name.trim() && !existingNamesLower.has(name.toLowerCase().trim())) {
            existingNamesLower.add(name.toLowerCase().trim()); // Prevent adding duplicates from the same selection
            return {
              id: `p-${Date.now()}-${Math.random()}`,
              name: name.trim(),
              amountOwed: 0,
              paid: false,
              splitValue: 0,
              email: email || undefined,
              phone: phone || undefined,
            };
          }
          return null;
        })
        .filter((p: Participant | null): p is Participant => p !== null);

      if (newParticipantsFromContacts.length === 0) return;

      // If there's an empty participant slot, fill it with the first new contact
      const firstEmptyIndex = participants.findIndex(p => p.name.trim() === '');
      if (firstEmptyIndex > -1) {
          const updatedParticipants = [...participants];
          const firstNew = newParticipantsFromContacts.shift();
          if (firstNew) {
              updatedParticipants[firstEmptyIndex] = firstNew;
          }
          setParticipants([...updatedParticipants, ...newParticipantsFromContacts]);
      } else {
          setParticipants([...participants, ...newParticipantsFromContacts]);
      }
    } catch (ex) {
      console.error('Error fetching contacts:', ex);
    }
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
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={handleAddParticipant} className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                  <span>Add Manually</span>
              </button>
              {isContactsApiSupported && (
                  <button type="button" onClick={handleAddFromContacts} className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-teal-500/50 dark:border-teal-400/50 rounded-lg text-teal-600 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/40 bg-teal-50/50 dark:bg-teal-900/20 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6z" />
                        <path fillRule="evenodd" d="M1.5 14.5a3 3 0 013-3h7a3 3 0 013 3v1a2 2 0 01-2 2H3.5a2 2 0 01-2-2v-1zM5 14a1 1 0 00-1 1v1a1 1 0 001 1h7a1 1 0 001-1v-1a1 1 0 00-1-1H5z" clipRule="evenodd" />
                      </svg>
                      <span>Add from Contacts</span>
                  </button>
              )}
          </div>
          {participantsError && <p className="text-sm text-red-500">{participantsError}</p>}
      </div>
    </div>
  );
};

export default BillParticipants;