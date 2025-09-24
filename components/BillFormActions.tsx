import React from 'react';

interface BillFormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  isEditing: boolean;
}

const BillFormActions: React.FC<BillFormActionsProps> = ({ onCancel, onSave, isEditing }) => {
  return (
    <div className="mt-8 flex justify-end space-x-4">
      <button onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
      <button onClick={onSave} className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">{isEditing ? 'Update Template' : 'Save'}</button>
    </div>
  );
};

export default BillFormActions;
