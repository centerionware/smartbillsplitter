import React, { useRef, useState } from 'react';
import type { RecurringBill, DashboardLayoutMode } from '../types';
import RecurringBillCard from './RecurringBillCard';

interface SwipeableRecurringBillCardProps {
  bill: RecurringBill;
  onClick: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  layoutMode: DashboardLayoutMode;
}

const ACTION_BUTTON_WIDTH = 70;

const SwipeableRecurringBillCard: React.FC<SwipeableRecurringBillCardProps> = ({ bill, onClick, onEdit, onArchive, onUnarchive, onDelete, layoutMode }) => {
  const [translateX, setTranslateX] = useState(0);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragInitialTranslateX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isScrolling = useRef(false);
  const dragStartTime = useRef(0);

  const isArchived = bill.status === 'archived';
  const maxTranslateX = layoutMode === 'card' ? -(ACTION_BUTTON_WIDTH * (isArchived ? 2 : 3)) : 0;

  const handleDragStart = (clientX: number, clientY: number) => {
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

    const newTranslateX = dragInitialTranslateX.current + deltaX;
    const newClampedTranslateX = Math.min(20, Math.max(maxTranslateX - 20, newTranslateX));
    setTranslateX(newClampedTranslateX);
  };

  const handleDragEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    
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
    
    if (translateX < maxTranslateX / 2) { setTranslateX(maxTranslateX); } else { setTranslateX(0); }
  };
  
  const executeAction = (action: () => void) => {
    action();
    setTranslateX(0);
  };

  return (
    <div className={`relative w-full ${layoutMode === 'card' ? 'overflow-hidden' : ''}`}>
      {layoutMode === 'card' && (
        <div className="absolute top-0 right-0 h-full flex items-center z-0">
          {!isArchived && (
              <button onClick={() => executeAction(onEdit)} className="h-full w-[70px] flex flex-col items-center justify-center bg-indigo-500 text-white transition-colors hover:bg-indigo-600" aria-label='Edit Template'>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                <span className="text-xs mt-1">Edit</span>
              </button>
          )}
          <button onClick={() => executeAction(isArchived ? onUnarchive : onArchive)} className="h-full w-[70px] flex flex-col items-center justify-center bg-blue-500 text-white transition-colors hover:bg-blue-600" aria-label={isArchived ? 'Unarchive' : 'Archive'}>
            {isArchived ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
            <span className="text-xs mt-1">{isArchived ? 'Unarchive' : 'Archive'}</span>
          </button>
          <button onClick={() => executeAction(onDelete)} className="h-full w-[70px] flex flex-col items-center justify-center bg-red-500 text-white transition-colors hover:bg-red-600" aria-label="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span className="text-xs mt-1">Delete</span>
          </button>
        </div>
      )}

      <div 
        ref={cardRef} 
        className="relative z-10" 
        style={{ transform: `translateX(${translateX}px)`, touchAction: 'pan-y' }} 
        onTouchStart={e => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)} 
        onTouchMove={e => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)} 
        onTouchEnd={e => handleDragEnd(e)} 
        onMouseDown={e => handleDragStart(e.clientX, e.clientY)} 
        onMouseMove={e => handleDragMove(e.clientX, e.clientY)} 
        onMouseUp={e => handleDragEnd(e)} 
        onMouseLeave={() => handleDragEnd()}
      >
        <RecurringBillCard bill={bill} onClick={() => { /* Click handled in dragEnd */ }} layoutMode={layoutMode} />
      </div>
    </div>
  );
};

export default SwipeableRecurringBillCard;