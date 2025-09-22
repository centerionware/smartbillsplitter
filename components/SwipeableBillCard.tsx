import React, { useRef, useState } from 'react';
import type { Bill } from '../types';
import BillCard from './BillCard';

interface SwipeableBillCardProps {
  bill: Bill;
  onClick: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = -80; // How far to swipe to trigger a snap
const ACTION_BUTTON_WIDTH = 70; // Width of each action button

const SwipeableBillCard: React.FC<SwipeableBillCardProps> = ({ bill, onClick, onArchive, onUnarchive, onDelete }) => {
  const [translateX, setTranslateX] = useState(0);
  const dragStartX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);

  const isArchived = bill.status === 'archived';
  const maxTranslateX = -(ACTION_BUTTON_WIDTH * 2);

  const handleDragStart = (clientX: number) => {
    isDragging.current = true;
    dragStartX.current = clientX;
    dragStartTime.current = Date.now();
    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging.current) return;
    const deltaX = clientX - dragStartX.current;
    // Allow swiping only from right to left, and cap the swipe distance
    const newTranslateX = Math.min(0, Math.max(maxTranslateX - 20, deltaX));
    setTranslateX(newTranslateX);
  };

  const handleDragEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.3s ease';
    }

    const dragDuration = Date.now() - dragStartTime.current;
    
    // Distinguish between a click and a swipe
    if (dragDuration < 250 && Math.abs(translateX) < 10) {
        onClick();
        setTranslateX(0);
        return;
    }

    if (translateX < SWIPE_THRESHOLD) {
      // Snap open to show actions
      setTranslateX(maxTranslateX);
    } else {
      // Snap back closed
      setTranslateX(0);
    }
  };
  
  const executeAction = (action: () => void) => {
      action();
      setTranslateX(0);
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      {/* Action Buttons Container */}
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button
          onClick={() => executeAction(isArchived ? onUnarchive : onArchive)}
          className="h-full w-[70px] flex flex-col items-center justify-center bg-blue-500 text-white transition-colors hover:bg-blue-600"
          aria-label={isArchived ? 'Unarchive' : 'Archive'}
        >
          {isArchived ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
          )}
          <span className="text-xs mt-1">{isArchived ? 'Unarchive' : 'Archive'}</span>
        </button>
        <button
          onClick={() => executeAction(onDelete)}
          className="h-full w-[70px] flex flex-col items-center justify-center bg-red-500 text-white transition-colors hover:bg-red-600"
          aria-label="Delete"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span className="text-xs mt-1">Delete</span>
        </button>
      </div>

      {/* The Draggable Card Content */}
      <div
        ref={cardRef}
        className="relative z-10"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={e => handleDragStart(e.touches[0].clientX)}
        onTouchMove={e => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
        onMouseDown={e => handleDragStart(e.clientX)}
        onMouseMove={e => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <BillCard bill={bill} onClick={() => { /* Click is handled in dragEnd */ }} />
      </div>
    </div>
  );
};

export default SwipeableBillCard;