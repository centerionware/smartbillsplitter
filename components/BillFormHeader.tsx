import React from 'react';

interface BillFormHeaderProps {
  isEditing: boolean;
  fromTemplateId: string | null;
  isRecurring: boolean;
  setIsRecurring: (isRecurring: boolean) => void;
}

const BillFormHeader: React.FC<BillFormHeaderProps> = ({ isEditing, fromTemplateId, isRecurring, setIsRecurring }) => {
  const title = isEditing ? 'Edit Template' : (fromTemplateId ? 'Create Bill from Template' : 'Create New Bill');

  return (
    <>
      <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-6">{title}</h2>
      <div className="flex items-center justify-end mb-6">
        <label htmlFor="isRecurring" className="mr-3 font-medium text-slate-700 dark:text-slate-200">
          {isEditing ? 'This is a recurring template' : 'Save as recurring template?'}
        </label>
        <button
          id="isRecurring"
          type="button"
          onClick={() => setIsRecurring(!isRecurring)}
          disabled={isEditing || !!fromTemplateId}
          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isEditing || !!fromTemplateId ? 'opacity-50 cursor-not-allowed' : ''} ${isRecurring ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </>
  );
};

export default BillFormHeader;