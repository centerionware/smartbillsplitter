import React, { useRef, useState } from 'react';
import ParticipantCard from './ParticipantCard.tsx';

interface SwipeableParticipantCardProps {
  participant: { name: string; totalOwed: number };
  onClick: () => void;
  onShare: () => void;
  onPaidInFull: () => void;
  isCopied: boolean;
}

const ACTION_BUTTON_WIDTH = 90; // Width for the "Paid in Full" button

const SwipeableParticipantCard: React.FC<SwipeableParticipantCardProps> = ({ participant, onClick, onShare, onPaidInFull, isCopied }) => {
  const [translateX, setTranslateX] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const dragStartX = useRef(0);
  const dragInitialTranslateX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);

  const maxTranslateX = -ACTION_BUTTON_WIDTH;

  const handleDragStart = (clientX: number) => {
    isDragging.current = true;
    dragStartX.current = clientX;
    dragInitialTranslateX.current = translateX;
    dragStartTime.current = Date.now();
    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging.current) return;
    const deltaX = clientX - dragStartX.current;
    const newTranslateX = dragInitialTranslateX.current + deltaX;
    const newClampedTranslateX = Math.min(20, Math.max(maxTranslateX - 20, newTranslateX));
    setTranslateX(newClampedTranslateX);
  };

  const handleDragEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }

    const dragDuration = Date.now() - dragStartTime.current;
    const dragDistance = translateX - dragInitialTranslateX.current;
    
    if (dragDuration < 250 && Math.abs(dragDistance) < 10) {
      if (dragInitialTranslateX.current !== 0) {
        setTranslateX(0);
      } else {
        onClick();
      }
      return;
    }
    
    if (translateX < maxTranslateX / 2) {
      setTranslateX(maxTranslateX);
    } else {
      setTranslateX(0);
    }
  };
  
  const executeAction = (action: () => void) => {
    setIsExiting(true);
    // Wait for animation to finish before calling the state-updating function
    setTimeout(() => {
      action();
    }, 300);
  };

  return (
    <div className={`relative w-full overflow-hidden transition-all duration-300 ease-in-out ${isExiting ? 'opacity-0 max-h-0 scale-95' : 'max-h-96'}`}>
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button
          onClick={() => executeAction(onPaidInFull)}
          className="h-full w-[90px] flex flex-col items-center justify-center bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
          aria-label={`Mark all bills for ${participant.name} as paid`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs mt-1 font-semibold">Paid in Full</span>
        </button>
      </div>

      <div
        ref={cardRef}
        className="relative z-10 h-full"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={e => handleDragStart(e.touches[0].clientX)}
        onTouchMove={e => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
        onMouseDown={e => handleDragStart(e.clientX)}
        onMouseMove={e => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <ParticipantCard
          name={participant.name}
          totalOwed={participant.totalOwed}
          onClick={() => { /* Click is now handled in dragEnd */ }}
          onShare={onShare}
          isCopied={isCopied}
        />
      </div>
    </div>
  );
};

export default SwipeableParticipantCard;