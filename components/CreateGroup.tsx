import React, { useState, useEffect, useCallback } from 'react';
import type { Group, Participant, SplitMode } from '../types';
import BillParticipants from './BillParticipants';
import BillSplitMethod from './BillSplitMethod';

interface CreateGroupProps {
  onSave: (group: Omit<Group, 'id' | 'lastUpdatedAt'>) => void;
  onUpdate: (group: Group) => void;
  onBack: () => void;
  groupToEdit?: Group;
}

const CreateGroup: React.FC<CreateGroupProps> = ({ onSave, onUpdate, onBack, groupToEdit }) => {
  const isEditing = !!groupToEdit;
  const [name, setName] = useState(groupToEdit?.name || '');
  const [participants, setParticipants] = useState<Participant[]>(groupToEdit?.participants || [{ id: `p-${Date.now()}`, name: '', amountOwed: 0, paid: false }]);
  const [splitMode, setSplitMode] = useState<SplitMode>(groupToEdit?.defaultSplit.mode || 'equally');
  const [errors, setErrors] = useState<{ name?: string, participants?: string }>({});

  useEffect(() => {
    // When switching to a mode that doesn't use splitValue, clear them
    if (splitMode === 'equally' || splitMode === 'item') {
      setParticipants(prev => prev.map(p => ({ ...p, splitValue: undefined })));
    }
  }, [splitMode]);

  const validate = () => {
    const newErrors: { name?: string, participants?: string } = {};
    if (!name.trim()) newErrors.name = 'Group name is required.';
    if (participants.length === 0 || participants.every(p => !p.name.trim())) newErrors.participants = 'A group must have at least one participant with a name.';
    if (participants.some(p => !p.name.trim())) newErrors.participants = 'All participants must have a name.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
    const finalParticipants = participants.filter(p => p.name.trim() !== '');

    const splitValues = (splitMode === 'amount' || splitMode === 'percentage')
      ? finalParticipants.reduce((acc, p) => {
          acc[p.id] = p.splitValue || 0;
          return acc;
        }, {} as Record<string, number>)
      : undefined;

    const groupData = {
      name,
      participants: finalParticipants,
      defaultSplit: {
        mode: splitMode,
        splitValues,
      }
    };

    if (isEditing && groupToEdit) {
      onUpdate({ ...groupToEdit, ...groupData });
    } else {
      onSave(groupData);
    }
    onBack();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        Back to Dashboard
      </button>

      <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-6">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200">{isEditing ? 'Edit Group' : 'Create New Group'}</h2>
        
        <div>
          <label htmlFor="groupName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Group Name</label>
          <input id="groupName" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
        </div>

        <BillParticipants participants={participants} setParticipants={setParticipants} splitMode={splitMode} participantsError={errors.participants} />
        
        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/30">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Default Split Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">When you create a bill from this group, these settings will be applied by default.</p>
            <BillSplitMethod splitMode={splitMode} setSplitMode={setSplitMode} />
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button type="button" onClick={onBack} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
          <button type="submit" className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{isEditing ? 'Update Group' : 'Save Group'}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateGroup;
