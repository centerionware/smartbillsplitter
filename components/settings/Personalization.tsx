import React from 'react';

interface PersonalizationProps {
    myDisplayName: string;
    shareTemplate: string;
    onDisplayNameChange: (name: string) => void;
    onShareTemplateChange: (template: string) => void;
}

const Personalization: React.FC<PersonalizationProps> = ({
    myDisplayName,
    shareTemplate,
    onDisplayNameChange,
    onShareTemplateChange
}) => {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-200">Personalization</h3>
            </div>
            <div>
                <label htmlFor="myDisplayName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">My Display Name</label>
                <input id="myDisplayName" type="text" value={myDisplayName || ''} onChange={(e) => onDisplayNameChange(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. Jane Doe" />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    This name will be shown to others when you share a bill. Defaults to 'Myself' if empty.
                </p>
            </div>
            <div>
                <label htmlFor="shareTemplate" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Share Message Template</label>
                <textarea id="shareTemplate" rows={5} value={shareTemplate || ''} onChange={(e) => onShareTemplateChange(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Use placeholders: <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{participantName}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{totalOwed}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{billList}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{paymentInfo}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{promoText}`}</code>.
                </p>
            </div>
        </div>
    );
};

export default Personalization;
