import React, { useState, useMemo, useCallback } from 'react';
import type { Group, Bill, Participant, Settings } from '../../types';
import { View } from '../../types';
import type { ParticipantData } from '../ParticipantList';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import GroupRemindersModal from './GroupRemindersModal';
import ShareActionSheet from '../ShareActionSheet';
import { generateShareText, generateOneTimeShareLink } from '../../services/shareService';
import { useAppControl } from '../../contexts/AppControlContext';

interface GroupDetailsViewProps {
  group: Group;
  participantsData: ParticipantData[];
  bills: Bill[];
  settings: Settings;
  subscriptionStatus: SubscriptionStatus;
  onBack: () => void;
  onSelectParticipant: (name: string) => void;
  onUpdateMultipleBills: (bills: Bill[]) => Promise<void>;
  navigate: (view: View, params?: any) => void;
}

const GroupDetailsView: React.FC<GroupDetailsViewProps> = ({ group, participantsData, bills, settings, subscriptionStatus, onBack, onSelectParticipant, onUpdateMultipleBills, navigate }) => {
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);
  const [shareSheetParticipant, setShareSheetParticipant] = useState<ParticipantData | null>(null);
  const { showNotification } = useAppControl();

  const groupParticipantsWithDebt = useMemo(() => {
    const participantNamesInGroup = new Set(group.participants.map(p => p.name));
    return participantsData.filter(pd => participantNamesInGroup.has(pd.name));
  }, [group, participantsData]);

  const handleRemindParticipant = (participant: ParticipantData) => {
    setIsRemindersModalOpen(false);
    setShareSheetParticipant(participant);
  };

  const getShareTextForParticipant = useCallback((participantName: string): string => {
    const participantData = participantsData.find(p => p.name === participantName && p.type === 'owed');
    if (!participantData) return "No outstanding bills found.";
    const activeBills = bills.filter(b => b.status === 'active');
    const billsInfo = activeBills.filter(b => b.participants.some(p => p.name === participantName && !p.paid && p.amountOwed > 0)).map(b => ({ description: b.description, amountOwed: b.participants.find(p => p.name === participantName)!.amountOwed }));
    return generateShareText(participantName, participantData.amount, billsInfo, settings, subscriptionStatus);
  }, [participantsData, bills, settings, subscriptionStatus]);

  const handleShareGeneric = async (participant: ParticipantData) => {
    const shareText = getShareTextForParticipant(participant.name);
    try {
      if (navigator.share) await navigator.share({ title: 'Bill Split Reminder', text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        showNotification('Share text copied to clipboard!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing or copying:", err);
        showNotification('Failed to share', 'error');
      }
    } finally {
      setShareSheetParticipant(null);
    }
  };
  
  const handleShareSms = (participant: ParticipantData) => {
    if (!participant.phone) return;
    window.location.href = `sms:${participant.phone}?&body=${encodeURIComponent(getShareTextForParticipant(participant.name))}`;
    setShareSheetParticipant(null);
  };
    
  const handleShareEmail = (participant: ParticipantData) => {
    if (!participant.email) return;
    window.location.href = `mailto:${participant.email}?subject=${encodeURIComponent("Shared Bill Reminder")}&body=${encodeURIComponent(getShareTextForParticipant(participant.name))}`;
    setShareSheetParticipant(null);
  };

  const handleShareLink = useCallback(async (participantName: string, method: 'sms' | 'email' | 'generic') => {
    const unpaidBills = bills.filter(b => b.status === 'active' && b.participants.some(p => p.name === participantName && !p.paid && p.amountOwed > 0));
    if (unpaidBills.length === 0) {
        showNotification(`${participantName} has no outstanding bills to share.`, 'info');
        setShareSheetParticipant(null);
        return;
    }
    const { shareUrl, imagesDropped } = await generateOneTimeShareLink(unpaidBills, participantName, settings, onUpdateMultipleBills, bills, subscriptionStatus);
    
    if (imagesDropped > 0) {
        showNotification(`Free image limit reached. ${imagesDropped} older image(s) omitted from summary.`, 'info');
    }

    const message = `Here is a link to view a summary of your outstanding bills with me. This link contains a key and should not be shared with others:\n\n${shareUrl}`;
    try {
        if (method === 'sms') {
            const phone = participantsData.find(p => p.name === participantName)?.phone;
            if (phone) window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
        } else if (method === 'email') {
            const email = participantsData.find(p => p.name === participantName)?.email;
            if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent("Summary of Outstanding Bills")}&body=${encodeURIComponent(message)}`;
        } else {
            if (navigator.share) await navigator.share({ title: 'Summary of Outstanding Bills', text: message });
            else {
                await navigator.clipboard.writeText(message);
                showNotification('Share link copied to clipboard!');
            }
        }
    } catch (err: any) {
        if (err.name === 'AbortError') showNotification('Share cancelled', 'info');
        else {
            console.error("Error sharing link:", err);
            showNotification('An error occurred while trying to share the link.', 'error');
        }
    } finally {
        setShareSheetParticipant(null);
    }
  }, [bills, settings, onUpdateMultipleBills, participantsData, showNotification, subscriptionStatus]);

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        Back to Dashboard
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <div className="flex justify-between items-start gap-4">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{group.name}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{group.participants.length} members</p>
            </div>
            <div className="flex-shrink-0">
                <button onClick={() => navigate(View.CreateGroup, { groupToEdit: group })} className="px-4 py-2 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
                    Edit
                </button>
            </div>
        </div>

        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Members</h3>
          <ul className="space-y-3">
            {group.participants.map(p => {
              const debtInfo = participantsData.find(pd => pd.name === p.name);
              const hasDebt = debtInfo && debtInfo.type === 'owed' && debtInfo.amount > 0;
              return (
                <li key={p.id}>
                  <button onClick={() => onSelectParticipant(p.name)} className="w-full flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600/50 text-left">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                    {hasDebt ? (
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Owes ${debtInfo.amount.toFixed(2)}</span>
                    ) : (
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">All settled</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
            <button onClick={() => setIsRemindersModalOpen(true)} className="w-full bg-teal-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors">
                Remind Group
            </button>
        </div>
      </div>
      {isRemindersModalOpen && (
        <GroupRemindersModal 
            group={group} 
            participantsWithDebt={groupParticipantsWithDebt}
            onClose={() => setIsRemindersModalOpen(false)}
            onRemind={handleRemindParticipant}
        />
      )}
      {shareSheetParticipant && (
        <ShareActionSheet 
            participant={{ ...shareSheetParticipant, id: shareSheetParticipant.name, amountOwed: shareSheetParticipant.amount, paid: false } as Participant} 
            onClose={() => setShareSheetParticipant(null)} 
            onShareSms={handleShareSms as any}
            onShareEmail={handleShareEmail as any}
            onShareGeneric={handleShareGeneric as any}
            onShareLinkSms={() => handleShareLink(shareSheetParticipant.name, 'sms')} 
            onShareLinkEmail={() => handleShareLink(shareSheetParticipant.name, 'email')} 
            onShareLinkGeneric={() => handleShareLink(shareSheetParticipant.name, 'generic')} 
            onViewDetails={() => { onSelectParticipant(shareSheetParticipant.name); setShareSheetParticipant(null); }} 
            shareContext="dashboard" 
        />
      )}
    </div>
  );
};

export default GroupDetailsView;