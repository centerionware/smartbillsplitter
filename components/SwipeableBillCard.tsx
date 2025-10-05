

import React, { useRef, useState } from 'react';
import type { Bill } from '../types';
import BillCard from './BillCard';

interface SwipeableBillCardProps {
  bill: Bill;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onReshare: () => void;
  onConvertToTemplate: () => void;
  onExport: () => void;
}

const ACTION_BUTTON_WIDTH = 70; // Width for each action button

const SwipeableBillCard: React.FC<SwipeableBillCardProps> = ({ bill, onClick, onArchive, onUnarchive, onDelete, onReshare, onConvertToTemplate, onExport }) => {
  const [translateX, setTranslateX] = useState(0);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragInitialTranslateX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isScrolling = useRef(false);
  const dragStartTime = useRef(0);
  
  const isArchived = bill.status === 'archived';
  const maxTranslateX = -(ACTION_BUTTON_WIDTH * 2); // Show 2 actions

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
    if (!isDragging.current || isScrolling.current) return;

    const deltaX = clientX - dragStartX.current;
    const deltaY = clientY - dragStartY.current;

    // Prioritize vertical scroll over horizontal swipe
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
      isScrolling.current = true;
      isDragging.current = false; // Stop tracking as a horizontal drag
      if (translateX !== 0) {
        if (cardRef.current) cardRef.current.style.transition = 'transform 0.2s ease-out';
        setTranslateX(0);
      }
      return;
    }
    
    if (Math.abs(deltaX) > 5) {
      const newTranslateX = dragInitialTranslateX.current + deltaX;
      // Allow some over-swipe for a natural feel
      const newClampedTranslateX = Math.min(20, Math.max(maxTranslateX - 20, newTranslateX));
      setTranslateX(newClampedTranslateX);
    }
  };

  const handleDragEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    const wasDragging = isDragging.current;
    isDragging.current = false;

    if (isScrolling.current) {
        isScrolling.current = false;
        return;
    }
    
    if (!wasDragging) return;

    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }

    const dragDuration = Date.now() - dragStartTime.current;
    const dragDistance = Math.abs(translateX - dragInitialTranslateX.current);
    
    // Treat as a click if the drag was short and quick
    if (dragDuration < 250 && dragDistance < 10) {
      if (translateX !== 0) {
        setTranslateX(0); // Close actions on tap
      } else {
        if (e) {
          // FIX: Prevent the default action (like a ghost click) on touch devices.
          if (e.type === 'touchend') {
            e.preventDefault();
          }
          // FIX: Remove incorrect type assertion to pass either event type to the handler.
          onClick(e);
        }
      }
      return;
    }
    
    // Snap to the open or closed position
    if (translateX < maxTranslateX / 2) {
      setTranslateX(maxTranslateX);
    } else {
      setTranslateX(0);
    }
  };
  
  const executeAction = (action: () => void) => {
    action();
    setTranslateX(0);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-lg h-full">
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button onClick={() => executeAction(isArchived ? onUnarchive : onArchive)} className="h-full w-[70px] flex flex-col items-center justify-center bg-blue-500 text-white transition-colors hover:bg-blue-600" aria-label={isArchived ? 'Unarchive' : 'Archive'}>
          {isArchived ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
          <span className="text-xs mt-1">{isArchived ? 'Unarchive' : 'Archive'}</span>
        </button>
        <button onClick={() => executeAction(onDelete)} className="h-full w-[70px] flex flex-col items-center justify-center bg-red-500 text-white transition-colors hover:bg-red-600" aria-label="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span className="text-xs mt-1">Delete</span>
        </button>
      </div>
      <div 
        ref={cardRef} 
        className="relative z-10 h-full" 
        style={{ transform: `translateX(${translateX}px)`, touchAction: 'pan-y' }} 
        onTouchStart={e => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)} 
        onTouchMove={e => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)} 
        onTouchEnd={e => handleDragEnd(e)} 
        onMouseDown={e => handleDragStart(e.clientX, e.clientY)} 
        onMouseMove={e => handleDragMove(e.clientX, e.clientY)} 
        onMouseUp={e => handleDragEnd(e)} 
        onMouseLeave={() => isDragging.current && handleDragEnd()}
      >
        <BillCard {...{bill, onClick, onArchive, onUnarchive, onDelete, onReshare, onConvertToTemplate, onExport}} />
      </div>
    </div>
  );
};

export default SwipeableBillCard;