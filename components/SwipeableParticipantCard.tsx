
import React, { useRef, useState } from 'react';
import ParticipantCard from './ParticipantCard.tsx';

interface SwipeableParticipantCardProps {
  participant: { name: string; amount: number; type: 'owed' | 'paid' };
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
  const dragStartY = useRef(0);
  const dragInitialTranslateX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isScrolling = useRef(false);
  const dragStartTime = useRef(0);

  const maxTranslateX = participant.type === 'owed' ? -ACTION_BUTTON_WIDTH : 0;

  const handleDragStart = (clientX: number, clientY: number) => {
    if (participant.type !== 'owed') return;
    isDragging.current = true;
    isScrolling.current = false;
    dragStartX.current = clientX;
    dragStartY.current = clientY;
    dragInitialTranslateX.current = translateX;
    dragStartTime.current = Date.now();
    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    if (isScrolling.current) return;

    const deltaX = clientX - dragStartX.current;
    const deltaY = clientY - dragStartY.current;

    // Check for scroll intent once at the beginning of the gesture
    if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 5) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        isScrolling.current = true;
        // This is a scroll. Stop tracking it as a drag for the swipeable component.
        isDragging.current = false;
        // If we started to drag a bit horizontally, snap back immediately.
        if (translateX !== 0) {
            if (cardRef.current) {
                cardRef.current.style.transition = 'transform 0.2s ease-out';
            }
            setTranslateX(0);
        }
        return;
      }
    }

    // Only runs if it's a horizontal swipe
    const newTranslateX = dragInitialTranslateX.current + deltaX;
    const newClampedTranslateX = Math.min(20, Math.max(maxTranslateX - 20, newTranslateX));
    setTranslateX(newClampedTranslateX);
  };

  const handleDragEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) {
        // If not dragging, it might be a simple tap
        if (Math.abs(dragStartX.current - (e as any).clientX) < 10 && (Date.now() - dragStartTime.current) < 250) {
             if (e && e.type === 'touchend') e.preventDefault();
             onClick();
        }
        return;
    }
    
    const wasScrolling = isScrolling.current;
    isDragging.current = false;
    isScrolling.current = false;
    
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }

    if (wasScrolling) {
      setTranslateX(0);
      return;
    }
    
    const dragDuration = Date.now() - dragStartTime.current;
    const dragDistance = translateX - dragInitialTranslateX.current;
    
    if (dragDuration < 250 && Math.abs(dragDistance) < 10) {
      if (dragInitialTranslateX.current !== 0) {
        setTranslateX(0);
      } else {
        // This is a tap. Prevent the ghost click for touch events.
        if (e && e.type === 'touchend') {
            e.preventDefault();
        }
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
       {participant.type === 'owed' && (
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
      )}

      <div
        ref={cardRef}
        className="relative z-10 h-full"
        style={{ transform: `translateX(${translateX}px)`, touchAction: participant.type === 'owed' ? 'pan-y' : 'auto' }}
        onTouchStart={e => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={e => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={e => handleDragEnd(e)}
        onMouseDown={e => handleDragStart(e.clientX, e.clientY)}
        onMouseMove={e => handleDragMove(e.clientX, e.clientY)}
        onMouseUp={e => handleDragEnd(e)}
        onMouseLeave={() => isDragging.current && handleDragEnd()}
      >
        <ParticipantCard
          data={participant}
          onClick={() => { /* Click is now handled in dragEnd */ }}
          onShare={onShare}
          isCopied={isCopied}
        />
      </div>
    </div>
  );
};

export default SwipeableParticipantCard;