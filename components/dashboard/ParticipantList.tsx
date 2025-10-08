import React from 'react';
import SwipeableParticipantCard from '../SwipeableParticipantCard';
import { DashboardLayoutMode } from '../../types';

export type ParticipantData = {
  name: string;
  amount: number;
  type: 'owed' | 'paid';
  phone?: string;
  email?: string;
};

interface ParticipantListProps {
  participantsData: ParticipantData[];
  onSetShareSheetParticipant: (participant: ParticipantData) => void;
  onMarkParticipantAsPaid: (name: string) => void;
  dashboardLayoutMode: DashboardLayoutMode;
}

const ParticipantList: React.FC<ParticipantListProps> = ({
  participantsData,
  onSetShareSheetParticipant,
  onMarkParticipantAsPaid,
  dashboardLayoutMode,
}) => {
  const layoutClasses = dashboardLayoutMode === 'card'
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    : "flex flex-col gap-4";

  return (
    <div className={layoutClasses}>
      {participantsData.map(p => (
        <SwipeableParticipantCard
          key={p.name}
          participant={p}
          onClick={() => onSetShareSheetParticipant(p)}
          onPaidInFull={() => onMarkParticipantAsPaid(p.name)}
        />
      ))}
    </div>
  );
};

export default ParticipantList;