
import React, { useState, useMemo } from 'react';
import type { ReceiptItem, Participant } from '../types';

interface ItemEditorProps {
  initialItems: ReceiptItem[];
  participants: Participant[];
  onSave: (items: ReceiptItem[]) => void;
  onCancel: () => void;
  isRecurring?: boolean;
}

const ItemEditor: React.FC<ItemEditorProps> = ({ initialItems, participants, onSave, onCancel, isRecurring }) => {
  const [items, setItems] = useState<ReceiptItem[]>(() => JSON.parse(JSON.stringify(initialItems)));

  const handleItemChange = (id: string, field: 'name' | 'price', value: string) => {
    setItems(currentItems =>
      currentItems.map(item => {
        if (item.id === id) {
          const newItem = { ...item };
          if (field === 'name') newItem.name = value;
          else if (field === 'price') newItem.price = parseFloat(value) || 0;
          return newItem;
        }
        return item;
      })
    );
  };
  
  const handleToggleAssignment = (itemId: string, participantId: string) => {
      setItems(currentItems => currentItems.map(item => {
          if (item.id === itemId) {
              const assignedTo = item.assignedTo.includes(participantId)
                ? item.assignedTo.filter(id => id !== participantId)
                : [...item.assignedTo, participantId];
              return { ...item, assignedTo };
          }
          return item;
      }));
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = { id: `item-manual-${Date.now()}`, name: '', price: 0, assignedTo: [] };
    setItems(currentItems => [...currentItems, newItem]);
  };

  const handleDeleteItem = (id: string) => setItems(currentItems => currentItems.filter(item => item.id !== id));

  const handleSave = () => {
    const finalItems = isRecurring
      ? items.filter(item => item.name.trim() !== '')
      : items.filter(item => item.name.trim() !== '' || item.price > 0);
    onSave(finalItems);
  };

  const currentTotal = useMemo(() => items.reduce((sum, item) => sum + (item.price || 0), 0), [items]);

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-60 z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true" aria-labelledby="item-editor-title">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 id="item-editor-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">{isRecurring ? 'Edit Default Items' : 'Edit Itemization'}</h2>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          {items.length === 0 ? <p className="text-center text-slate-500 dark:text-slate-400">No items yet. Add one to get started.</p> : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-grow">
                      <label htmlFor={`item-name-${item.id}`} className="sr-only">Item Name</label>
                      <input id={`item-name-${item.id}`} type="text" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} placeholder="Item Name" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                    </div>
                    {!isRecurring && (
                      <div className="w-28"><label htmlFor={`item-price-${item.id}`} className="sr-only">Price</label>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                          <input id={`item-price-${item.id}`} type="number" step="0.01" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', e.target.value)} placeholder="0.00" className="w-full pl-7 pr-2 py-2 border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
                        </div>
                      </div>
                    )}
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full flex-shrink-0" aria-label={`Delete item ${item.name}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                  </div>
                  {!isRecurring && participants.length > 0 && (
                      <div className="mt-3">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Assigned to:</p>
                          <div className="flex flex-wrap gap-2">
                              {participants.filter(p => p.name.trim() !== '').map(p => (
                                  <button type="button" key={p.id} onClick={() => handleToggleAssignment(item.id, p.id)}
                                    className={`flex items-center justify-center h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all ring-2 ring-offset-2 dark:ring-offset-slate-700 ${item.assignedTo.includes(p.id) ? 'bg-teal-500 text-white ring-teal-500' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 ring-transparent'}`}>
                                      {p.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6"><button onClick={handleAddItem} className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg><span>Add Item</span></button></div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            {!isRecurring && <><span className="text-sm font-medium text-slate-500 dark:text-slate-400">New Total:</span><span className="ml-2 text-lg font-bold text-slate-800 dark:text-slate-100">${currentTotal.toFixed(2)}</span></>}
          </div>
          <div className="flex space-x-4">
            <button onClick={onCancel} className="px-5 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemEditor;
