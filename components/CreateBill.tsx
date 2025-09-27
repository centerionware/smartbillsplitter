import React, { useState, useMemo, useEffect } from 'react';
import type { Bill, Participant, ReceiptItem, Settings, RecurringBill, RecurrenceRule, SplitMode } from '../types';
// FIX: Updated import path for RequestConfirmationFn to central types file.
import type { RequestConfirmationFn } from '../types.ts';
import ReceiptScanner from './ReceiptScanner.tsx';
import ItemEditor from './ItemEditor.tsx';
import RecurrenceSelector from './RecurrenceSelector.tsx';
import AdditionalInfoEditor from './AdditionalInfoEditor.tsx';
import BillFormHeader from './BillFormHeader.tsx';
import BillPrimaryDetails from './BillPrimaryDetails.tsx';
import BillSplitMethod from './BillSplitMethod.tsx';
import BillParticipants from './BillParticipants.tsx';
import BillExtraDetails from './BillExtraDetails.tsx';
import BillFormActions from './BillFormActions.tsx';

interface CreateBillProps {
  onSave: (bill: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => void;
  onSaveRecurring: (bill: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => void;
  onUpdateRecurring: (bill: RecurringBill) => void;
  onCancel: () => void;
  requestConfirmation: RequestConfirmationFn;
  settings: Settings | null;
  billTemplate: RecurringBill | { forEditing: RecurringBill } | null;
}

const getTemplateData = (templateProp: RecurringBill | { forEditing: RecurringBill } | null) => {
    if (!templateProp) return { template: null, isEditing: false, fromTemplateId: null };
    if ('forEditing' in templateProp) {
        return { template: templateProp.forEditing, isEditing: true, fromTemplateId: null };
    }
    return { template: templateProp, isEditing: false, fromTemplateId: templateProp.id };
}

export const CreateBill: React.FC<CreateBillProps> = ({
  onSave, onSaveRecurring, onUpdateRecurring, onCancel, requestConfirmation, settings, billTemplate: templateProp
}) => {
  const { template, isEditing, fromTemplateId } = getTemplateData(templateProp);

  // --- State Initialization ---
  const [description, setDescription] = useState(template?.description || '');
  const [totalAmount, setTotalAmount] = useState<number | undefined>(template?.totalAmount);
  const [date, setDate] = useState(template?.nextDueDate || new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const initialParticipants = template?.participants ? JSON.parse(JSON.stringify(template.participants)) : [];
    if (initialParticipants.length === 0 && settings?.myDisplayName) {
        return [{ id: `p-${Date.now()}`, name: settings.myDisplayName, amountOwed: 0, paid: false }];
    }
    return initialParticipants;
  });
  const [items, setItems] = useState<ReceiptItem[]>(() => template?.items ? JSON.parse(JSON.stringify(template.items)) : []);
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [additionalInfo, setAdditionalInfo] = useState(() => {
    const info = template?.additionalInfo;
    return info ? Object.entries(info).map(([key, value], i) => ({ id: `info-template-${i}`, key, value: String(value) })) : [];
  });

  // --- Bill Logic State ---
  const [splitMode, setSplitMode] = useState<SplitMode>(template?.splitMode || 'equally');
  const [isRecurring, setIsRecurring] = useState(isEditing || !!template?.recurrenceRule);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(template?.recurrenceRule || {
    frequency: 'monthly', interval: 1, dayOfMonth: new Date().getDate()
  });

  // --- UI State ---
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [isInfoEditorOpen, setIsInfoEditorOpen] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // --- Derived State ---
  const myNameLower = settings?.myDisplayName.toLowerCase().trim();

  // --- Effects ---
  useEffect(() => {
    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    if (activeParticipants.length === 0 || !totalAmount || splitMode === 'item') return;

    let newParticipants = JSON.parse(JSON.stringify(participants));

    switch (splitMode) {
        case 'equally':
            const amountPerPerson = totalAmount / activeParticipants.length;
            newParticipants.forEach((p: Participant) => {
                p.amountOwed = p.name.trim() ? amountPerPerson : 0;
            });
            break;
        case 'amount':
            const totalSplit = newParticipants.reduce((sum: number, p: Participant) => sum + (p.splitValue || 0), 0);
            if (Math.abs(totalSplit - totalAmount) > 0.01) {
                setErrors(prev => ({ ...prev, split: `Amounts must add up to $${totalAmount.toFixed(2)}. Current total: $${totalSplit.toFixed(2)}` }));
            } else {
                setErrors(prev => ({ ...prev, split: '' }));
            }
            newParticipants.forEach((p: Participant) => p.amountOwed = p.splitValue || 0);
            break;
        case 'percentage':
            const totalPercent = newParticipants.reduce((sum: number, p: Participant) => sum + (p.splitValue || 0), 0);
             if (Math.abs(totalPercent - 100) > 0.1) {
                setErrors(prev => ({ ...prev, split: `Percentages must add up to 100%. Current total: ${totalPercent.toFixed(2)}%`}));
            } else {
                setErrors(prev => ({ ...prev, split: '' }));
            }
            newParticipants.forEach((p: Participant) => p.amountOwed = (totalAmount * (p.splitValue || 0)) / 100);
            break;
    }
    
    setParticipants(newParticipants);

  }, [totalAmount, splitMode, participants.length, participants.map(p => p.splitValue).join(',')]);
  
  useEffect(() => {
    if (splitMode !== 'item' || items.length === 0) return;
    
    const newParticipants = JSON.parse(JSON.stringify(participants));
    let newTotal = 0;

    newParticipants.forEach((p: Participant) => p.amountOwed = 0);
    
    items.forEach(item => {
        newTotal += item.price;
        if (item.assignedTo.length > 0) {
            const pricePerPerson = item.price / item.assignedTo.length;
            item.assignedTo.forEach(participantId => {
                const participant = newParticipants.find((p: Participant) => p.id === participantId);
                if (participant) {
                    participant.amountOwed += pricePerPerson;
                }
            });
        }
    });
    setParticipants(newParticipants);
    setTotalAmount(newTotal);

  }, [items, splitMode]);
  
  // --- Handlers ---
  const handleItemsScanned = (data: any) => {
    setDescription(data.description || '');
    if (data.date) setDate(data.date);
    if (data.total) setTotalAmount(data.total);

    const newItems = data.items.map((item: any, index: number) => ({
      id: `item-scan-${Date.now()}-${index}`,
      name: item.name,
      price: item.price,
      assignedTo: [],
    }));
    setItems(newItems);

    const newInfo = data.additionalInfo?.map((info: any, index: number) => ({
      id: `info-scan-${Date.now()}-${index}`,
      key: info.key,
      value: info.value,
    })) || [];
    setAdditionalInfo(newInfo);
    
    setSplitMode('item');
  };

  const handleSaveItems = (updatedItems: ReceiptItem[]) => {
    setItems(updatedItems);
    setIsItemEditorOpen(false);
  };
  
  const handleSaveInfo = (updatedInfo: { id: string; key: string; value: string }[]) => {
    setAdditionalInfo(updatedInfo);
    setIsInfoEditorOpen(false);
  };
  
  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!description.trim()) newErrors.description = "Description is required.";
    
    // Basic validation for total amount
    if (!isRecurring && (!totalAmount || totalAmount <= 0) && splitMode !== 'item') {
        newErrors.totalAmount = "Total amount must be greater than zero.";
    }
    if (isRecurring && totalAmount && totalAmount < 0) {
        newErrors.totalAmount = "Total amount cannot be negative.";
    }

    // Stricter validation: if items exist, the total must match the item sum.
    if (items.length > 0 && totalAmount && splitMode !== 'item') {
        const itemizationTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
        if (Math.abs(totalAmount - itemizationTotal) > 0.01) {
            newErrors.totalAmount = `Amount must match item total ($${itemizationTotal.toFixed(2)}). Adjust total or add tax/tip as separate items.`;
        }
    }

    if (participants.filter(p => p.name.trim()).length < 1) {
        newErrors.participants = "At least one participant is required.";
    }
    if (errors.split) {
        newErrors.split = errors.split;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSaveClick = () => {
    if (!validate()) return;
    
    // --- Final Calculation Pass ---
    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    let finalParticipants: Participant[] = JSON.parse(JSON.stringify(activeParticipants));
    let finalTotalAmount = totalAmount || 0;
    
    // 1. Recalculate total if splitting by item, otherwise use the state value.
    if (splitMode === 'item') {
        finalTotalAmount = items.reduce((sum, item) => sum + item.price, 0);
    }

    // 2. Recalculate `amountOwed` for all participants based on final values.
    if (finalParticipants.length > 0) {
        switch (splitMode) {
            case 'item':
                finalParticipants.forEach(p => p.amountOwed = 0);
                items.forEach(item => {
                    if (item.assignedTo.length > 0) {
                        const pricePerPerson = item.price / item.assignedTo.length;
                        item.assignedTo.forEach(pId => {
                            const p = finalParticipants.find(fp => fp.id === pId);
                            if (p) p.amountOwed += pricePerPerson;
                        });
                    }
                });
                break;
            case 'equally':
                const amountPerPerson = finalTotalAmount / finalParticipants.length;
                finalParticipants.forEach(p => p.amountOwed = amountPerPerson);
                break;
            case 'amount':
                finalParticipants.forEach(p => p.amountOwed = p.splitValue || 0);
                break;
            case 'percentage':
                finalParticipants.forEach(p => p.amountOwed = (finalTotalAmount * (p.splitValue || 0)) / 100);
                break;
        }
    }
    
    // 3. Clean up temporary splitValue from participants. Paid status is preserved from the state.
    finalParticipants.forEach(p => {
        delete p.splitValue;
    });

    const additionalInfoObject = additionalInfo.reduce((acc, info) => {
      if (info.key.trim()) acc[info.key.trim()] = info.value;
      return acc;
    }, {} as Record<string, string>);
      
    if (isRecurring) {
        const recurringBillData = {
            description,
            totalAmount: totalAmount || undefined,
            participants: finalParticipants.map(({ amountOwed, paid, ...rest }) => ({ ...rest, amountOwed: 0, paid: false })),
            items: items,
            splitMode,
            recurrenceRule,
            additionalInfo: additionalInfoObject,
        };
        if (isEditing && template) {
            onUpdateRecurring({ ...template, ...recurringBillData });
        } else {
            onSaveRecurring(recurringBillData);
        }
    } else {
        const billData: Omit<Bill, 'id' | 'status'> = {
            description,
            totalAmount: finalTotalAmount,
            date,
            participants: finalParticipants,
            items,
            receiptImage,
            additionalInfo: additionalInfoObject,
        };
        onSave(billData, fromTemplateId || undefined);
    }
  };

  // FIX: Added handleBack function and return statement to render the component UI.
  const handleBack = () => {
    // This is a simplified check for unsaved changes.
    const hasData = description.trim() || totalAmount || participants.length > 1 || (participants.length === 1 && participants[0].name.toLowerCase().trim() !== myNameLower) || items.length > 0;
    
    if (hasData) {
      requestConfirmation(
        'Discard Changes?',
        'You have unsaved changes that will be lost. Are you sure you want to go back?',
        onCancel,
        { confirmText: 'Discard', confirmVariant: 'danger' }
      );
    } else {
      onCancel();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <BillFormHeader
          isEditing={isEditing}
          fromTemplateId={fromTemplateId}
          isRecurring={isRecurring}
          setIsRecurring={setIsRecurring}
        />

        <div className="space-y-6">
          <ReceiptScanner
            onItemsScanned={handleItemsScanned}
            onImageSelected={isRecurring ? () => {} : setReceiptImage}
            onImageCleared={() => setReceiptImage(undefined)}
            isForTemplate={isRecurring}
          />

          <BillPrimaryDetails
            description={description}
            setDescription={setDescription}
            totalAmount={totalAmount}
            setTotalAmount={setTotalAmount}
            date={date}
            setDate={setDate}
            isRecurring={isRecurring}
            splitMode={splitMode}
            errors={errors}
          />
          
          <BillExtraDetails
            items={items}
            additionalInfo={additionalInfo}
            onEditItems={() => setIsItemEditorOpen(true)}
            onEditInfo={() => setIsInfoEditorOpen(true)}
            isRecurring={isRecurring}
          />
          
          {isRecurring && (
            <RecurrenceSelector
              value={recurrenceRule}
              onChange={setRecurrenceRule}
            />
          )}

          <BillSplitMethod
            splitMode={splitMode}
            setSplitMode={setSplitMode}
            splitError={errors.split}
          />

          <BillParticipants
            participants={participants}
            setParticipants={setParticipants}
            splitMode={splitMode}
            participantsError={errors.participants}
          />
        </div>
        
        <BillFormActions
          onCancel={handleBack}
          onSave={handleSaveClick}
          isEditing={isEditing}
        />
      </div>

      {isItemEditorOpen && (
        <ItemEditor
          initialItems={items}
          participants={participants}
          onSave={handleSaveItems}
          onCancel={() => setIsItemEditorOpen(false)}
          isRecurring={isRecurring}
        />
      )}

      {isInfoEditorOpen && (
        <AdditionalInfoEditor
          initialInfo={additionalInfo}
          onSave={handleSaveInfo}
          onCancel={() => setIsInfoEditorOpen(false)}
        />
      )}
    </div>
  );
};