import React, { useState, useLayoutEffect, useRef } from 'react';

interface TutorialOverlayProps {
  targetSelector: string;
  title: string;
  description: string;
  buttonText?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  onClose: () => void;
}

const ARROW_SIZE = 12;
const POPOVER_MARGIN = 16;

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  targetSelector,
  title,
  description,
  buttonText = 'Got It!',
  placement = 'bottom',
  onClose,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [styles, setStyles] = useState<{ popover: React.CSSProperties; arrow: React.CSSProperties }>({ popover: { opacity: 0 }, arrow: {} });

  // Effect 1: Find the target element and update its position on scroll/resize.
  useLayoutEffect(() => {
    const updateTargetRect = () => {
      const targetElement = document.querySelector(targetSelector);
      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      } else {
        console.warn(`Tutorial target selector "${targetSelector}" not found.`);
        setTargetRect(null);
      }
    };
    
    updateTargetRect(); // Find it initially

    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [targetSelector]);

  // Effect 2: Position the popover relative to the target, once both exist.
  useLayoutEffect(() => {
    if (targetRect && popoverRef.current) {
      const popoverElement = popoverRef.current;
      const popoverRect = popoverElement.getBoundingClientRect();
      
      const newPopoverStyle: React.CSSProperties = { 
        opacity: 1, 
        transition: 'top 0.2s ease-out, left 0.2s ease-out, opacity 0.2s ease-in' 
      };
      const newArrowStyle: React.CSSProperties = {};
      const targetCenterX = targetRect.left + targetRect.width / 2;
      
      switch (placement) {
        case 'bottom': {
          let popoverLeft = targetCenterX - popoverRect.width / 2;
          
          // Clamp to viewport
          if (popoverLeft < POPOVER_MARGIN) {
            popoverLeft = POPOVER_MARGIN;
          } else if (popoverLeft + popoverRect.width > window.innerWidth - POPOVER_MARGIN) {
            popoverLeft = window.innerWidth - POPOVER_MARGIN - popoverRect.width;
          }

          newPopoverStyle.top = `${targetRect.bottom + ARROW_SIZE + POPOVER_MARGIN}px`;
          newPopoverStyle.left = `${popoverLeft}px`;
          
          newArrowStyle.bottom = '100%';
          newArrowStyle.left = `${targetCenterX - popoverLeft}px`;
          newArrowStyle.transform = 'translateX(-50%)';
          break;
        }
        // Other placements can be added here
      }

      setStyles({ popover: newPopoverStyle, arrow: newArrowStyle });
    } else {
      // Hide if target is gone
      setStyles({ popover: { opacity: 0 }, arrow: {} });
    }
  }, [targetRect, placement]);


  if (!targetRect) {
    return null;
  }
  
  const arrowClasses = {
      bottom: 'border-b-white dark:border-b-slate-800',
      top: 'border-t-white dark:border-t-slate-800',
      left: 'border-l-white dark:border-l-slate-800',
      right: 'border-r-white dark:border-r-slate-800',
  }[placement];

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[100] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      {/* Highlighter Element */}
      <div
        className="absolute rounded-lg pointer-events-none animate-pulse-glow border-2 border-white/50"
        style={{
          top: `${targetRect.top - 4}px`,
          left: `${targetRect.left - 4}px`,
          width: `${targetRect.width + 8}px`,
          height: `${targetRect.height + 8}px`,
          transition: 'all 0.2s ease-out',
        }}
      />

      {/* Popover with Tooltip */}
      <div
        ref={popoverRef}
        className="absolute max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 text-center"
        style={styles.popover}
        onClick={e => e.stopPropagation()}
      >
        {/* Arrow */}
        <div 
          className={`absolute w-0 h-0 border-solid border-transparent ${arrowClasses}`}
          style={{ ...styles.arrow, borderWidth: `${ARROW_SIZE}px` }}
        />
        
        <h2 id="tutorial-title" className="text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">
          {description}
        </p>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default TutorialOverlay;