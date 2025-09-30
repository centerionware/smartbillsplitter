import React, { useState, useEffect, useCallback } from 'react';
import type { DashboardView } from '../types';
import TutorialOverlay from './TutorialOverlay';

interface TutorialManagerProps {
  dashboardView: DashboardView;
  selectedParticipant: string | null;
}

const TutorialManager: React.FC<TutorialManagerProps> = ({ dashboardView, selectedParticipant }) => {
  const [showTutorial, setShowTutorial] = useState(false);

  // Show tutorial on first load on the main dashboard view
  useEffect(() => {
    if (dashboardView === 'bills' && !selectedParticipant) {
      const tutorialCompleted = localStorage.getItem('sharedbills.tutorialCompleted');
      if (!tutorialCompleted) {
        const timer = setTimeout(() => setShowTutorial(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [dashboardView, selectedParticipant]);

  const handleCloseTutorial = useCallback(() => {
    localStorage.setItem('sharedbills.tutorialCompleted', 'true');
    setShowTutorial(false);
  }, []);

  if (!showTutorial) {
    return null;
  }

  return (
    <TutorialOverlay
      targetSelector="#create-new-bill-button"
      title="Welcome!"
      description="To get started, tap the plus button to create your first bill."
      buttonText="Got It!"
      onClose={handleCloseTutorial}
      placement="bottom"
    />
  );
};

export default TutorialManager;