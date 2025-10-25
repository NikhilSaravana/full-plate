import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const GuidedTour = ({ isOpen, onClose, onStartTour }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const tourSteps = [
    {
      id: 'welcome',
      title: t('tour.welcome.title'),
      content: t('tour.welcome.content'),
      position: 'center',
      target: null
    },
    {
      id: 'header-stats',
      title: t('tour.stats.title'),
      content: t('tour.stats.content'),
      position: 'bottom-right',
      target: '.header-stats'
    },
    {
      id: 'navigation',
      title: t('tour.navigation.title'),
      content: t('tour.navigation.content'),
      position: 'bottom',
      target: '.nav-with-icons'
    },
    {
      id: 'food-intake-tab',
      title: t('tour.food-intake.title'),
      content: t('tour.food-intake.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="dataentry"]'
    },
    {
      id: 'distribution-tab',
      title: t('tour.distribution.title'),
      content: t('tour.distribution.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="distribution"]'
    },
    {
      id: 'myplate-tab',
      title: t('tour.myplate.title'),
      content: t('tour.myplate.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="myplate"]'
    },
    {
      id: 'reports-tab',
      title: t('tour.reports.title'),
      content: t('tour.reports.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="reports"]'
    },
    {
      id: 'language-selector',
      title: t('tour.language.title'),
      content: t('tour.language.content'),
      position: 'top-right',
      target: '.language-selector'
    }
  ];

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    setIsRunning(false);
    setCurrentStep(0);
    onClose();
  };

  const handleStartTour = () => {
    setIsRunning(true);
    setCurrentStep(0);
    onStartTour();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Remove any existing highlights
      removeHighlight();
    }
    return () => {
      document.body.style.overflow = 'unset';
      removeHighlight();
    };
  }, [isOpen]);

  // Highlight target element
  useEffect(() => {
    if (isOpen && currentStep > 0) {
      const step = tourSteps[currentStep];
      if (step.target) {
        highlightElement(step.target);
      }
    }
    return () => {
      removeHighlight();
    };
  }, [currentStep, isOpen]);

  const highlightElement = (selector) => {
    removeHighlight(); // Remove any existing highlight
    
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('tour-highlight');
      setHighlightedElement(element);
      updateSpotlight(element);
      
      // Scroll element into view
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
    }
  };

  const removeHighlight = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('tour-highlight');
      setHighlightedElement(null);
    }
    setSpotlightRect(null);
  };

  const updateSpotlight = (element) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const padding = 6; // small padding around element
    setSpotlightRect({
      top: rect.top + scrollTop - padding,
      left: rect.left + scrollLeft - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
  };

  // Keep spotlight aligned on scroll/resize
  useEffect(() => {
    const handleRealign = () => {
      if (highlightedElement) updateSpotlight(highlightedElement);
    };
    window.addEventListener('scroll', handleRealign, true);
    window.addEventListener('resize', handleRealign);
    return () => {
      window.removeEventListener('scroll', handleRealign, true);
      window.removeEventListener('resize', handleRealign);
    };
  }, [highlightedElement]);

  if (!isOpen) return null;

  if (!isRunning) {
    return (
      <div className="guided-tour-overlay">
        <div className="guided-tour-modal">
          <div className="tour-header">
            <h2>{t('tour.modal.title')}</h2>
            <button className="tour-close-btn" onClick={onClose}>×</button>
          </div>
          <div className="tour-content">
            <div className="tour-icon"></div>
            <h3>{t('tour.modal.welcome')}</h3>
            <p>{t('tour.modal.description')}</p>
            <div className="tour-features">
              <div className="feature-item">
                <span className="feature-icon"></span>
                <span>{t('tour.modal.feature1')}</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon"></span>
                <span>{t('tour.modal.feature2')}</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon"></span>
                <span>{t('tour.modal.feature3')}</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon"></span>
                <span>{t('tour.modal.feature4')}</span>
              </div>
            </div>
            <div className="tour-actions">
              <button className="btn btn-primary btn-large" onClick={handleStartTour}>
                {t('tour.modal.start')}
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                {t('tour.modal.skip')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = tourSteps[currentStep];

  // Calculate position based on target element
  const getStepPosition = () => {
    if (!currentStepData.target) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const rect = targetElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    switch (currentStepData.position) {
      case 'top-right':
        return {
          top: rect.top + scrollTop - 10,
          right: window.innerWidth - rect.right - scrollLeft - 10
        };
      case 'top-left':
        return {
          top: rect.top + scrollTop - 10,
          left: rect.left + scrollLeft - 10
        };
      case 'bottom':
        return {
          top: rect.bottom + scrollTop + 10,
          left: rect.left + scrollLeft + (rect.width / 2),
          transform: 'translateX(-50%)'
        };
      case 'bottom-right':
        return {
          top: rect.bottom + scrollTop + 10,
          right: window.innerWidth - rect.right - scrollLeft - 10
        };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const stepPosition = getStepPosition();

  return (
    <div className="guided-tour-overlay">
      {spotlightRect && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height
          }}
        />
      )}
      <div 
        className={`guided-tour-step ${currentStepData.position}`}
        style={stepPosition}
      >
        <div className="tour-step-content">
          <div className="tour-step-header">
            <h3>{currentStepData.title}</h3>
            <span className="tour-step-counter">{currentStep + 1} of {tourSteps.length}</span>
          </div>
          <div className="tour-step-body">
            <p>{currentStepData.content}</p>
          </div>
          <div className="tour-step-actions">
            <button 
              className="btn btn-secondary" 
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              {t('btn.previous')}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleNext}
            >
              {currentStep === tourSteps.length - 1 ? t('btn.finish') : t('btn.next')}
            </button>
          </div>
        </div>
        <div className="tour-step-arrow"></div>
      </div>
    </div>
  );
};

export default GuidedTour;