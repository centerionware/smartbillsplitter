import React from 'react';
import SwipeableParticipantCard from '../SwipeableParticipantCard.tsx';

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
}

const ParticipantList: React.FC<ParticipantListProps> = ({
  participantsData,
  onSetShareSheetParticipant,
  onMarkParticipantAsPaid,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
