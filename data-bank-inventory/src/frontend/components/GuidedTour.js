import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';
import '../styles/GuidedTour.css';

const GuidedTour = ({ isOpen, onClose, onStartTour, onNavigate }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [, setForceUpdate] = useState(0); // Force re-render for position updates

  // Accessibility: manage focus trapping inside the tour overlay
  const overlayRef = useRef(null);
  const previouslyFocusedElement = useRef(null);

  // When the tour is opened/closed manage focus movement
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement;
      // Delay focus to ensure overlay elements are in DOM
      setTimeout(() => {
        const focusable = overlayRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length) {
          focusable[0].focus();
        } else {
          overlayRef.current?.focus();
        }
      }, 0);
    } else if (previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus();
    }
  }, [isOpen]);

  // Handle Escape to close and trap Tab inside overlay
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'Tab' && overlayRef.current) {
      const focusable = overlayRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return; // nothing to trap
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const tourSteps = [
    {
      id: 'welcome',
      title: t('tour.welcome.title'),
      content: t('tour.welcome.content'),
      position: 'center',
      target: null,
      tab: null
    },
    {
      id: 'header-stats',
      title: t('tour.stats.title'),
      content: t('tour.stats.content'),
      position: 'bottom-right',
      target: '.header-stats',
      tab: null
    },
    {
      id: 'global-search',
      title: t('tour.global-search.title'),
      content: t('tour.global-search.content'),
      position: 'bottom',
      target: '.global-search',
      tab: null
    },
    {
      id: 'navigation',
      title: t('tour.navigation.title'),
      content: t('tour.navigation.content'),
      position: 'bottom',
      target: '.nav-with-icons',
      tab: null
    },
    {
      id: 'quick-actions',
      title: t('tour.quick-actions.title'),
      content: t('tour.quick-actions.content'),
      position: 'top',
      target: '.quick-actions',
      tab: 'overview'
    },
    {
      id: 'food-intake-tab',
      title: t('tour.food-intake.title'),
      content: t('tour.food-intake.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="dataentry"]',
      tab: null
    },
    {
      id: 'single-bulk-tabs',
      title: t('tour.single-bulk-tabs.title'),
      content: t('tour.single-bulk-tabs.content'),
      position: 'bottom',
      target: '.survey-header .nav-with-icons',
      tab: 'dataentry'
    },
    {
      id: 'entry-metadata',
      title: t('tour.entry-metadata.title'),
      content: t('tour.entry-metadata.content'),
      position: 'bottom-left',
      target: '.survey-form .form-section:first-child',
      tab: 'dataentry'
    },
    {
      id: 'quick-add',
      title: t('tour.quick-add.title'),
      content: t('tour.quick-add.content'),
      position: 'top',
      target: '.quick-add-buttons',
      tab: 'dataentry'
    },
    {
      id: 'add-item',
      title: t('tour.add-item.title'),
      content: t('tour.add-item.content'),
      position: 'bottom-left',
      target: 'button.btn.btn-primary[style*="margin"]',
      tab: 'dataentry'
    },
    {
      id: 'submit-data',
      title: t('tour.submit-data.title'),
      content: t('tour.submit-data.content'),
      position: 'top',
      target: 'button.btn.btn-primary.btn-large',
      tab: 'dataentry'
    },
    {
      id: 'distribution-tab',
      title: t('tour.distribution.title'),
      content: t('tour.distribution.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="distribution"]',
      tab: null
    },
    {
      id: 'recipient-info',
      title: t('tour.recipient-info.title'),
      content: t('tour.recipient-info.content'),
      position: 'bottom',
      target: 'input[placeholder*="Community"]',
      tab: 'distribution'
    },
    {
      id: 'age-demographics',
      title: t('tour.age-demographics.title'),
      content: t('tour.age-demographics.content'),
      position: 'top',
      target: '.form-section .form-section',
      tab: 'distribution'
    },
    {
      id: 'submit-distribution',
      title: t('tour.submit-distribution.title'),
      content: t('tour.submit-distribution.content'),
      position: 'top',
      target: 'button.btn.btn-primary.btn-large',
      tab: 'distribution'
    },
    {
      id: 'myplate-tab',
      title: t('tour.myplate.title'),
      content: t('tour.myplate.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="myplate"]',
      tab: null
    },
    {
      id: 'myplate-table',
      title: t('tour.myplate-table.title'),
      content: t('tour.myplate-table.content'),
      position: 'top-left',
      target: '.calculations-table',
      tab: 'myplate'
    },
    {
      id: 'myplate-status',
      title: t('tour.myplate-status.title'),
      content: t('tour.myplate-status.content'),
      position: 'top-left',
      target: '.calculations-table thead',
      tab: 'myplate'
    },
    {
      id: 'reports-tab',
      title: t('tour.reports.title'),
      content: t('tour.reports.content'),
      position: 'bottom',
      target: '.nav-tab[data-tab="reports"]',
      tab: null
    },
    {
      id: 'report-types',
      title: t('tour.report-types.title'),
      content: t('tour.report-types.content'),
      position: 'top-left',
      target: '.reports-interface .form-section',
      tab: 'reports'
    },
    {
      id: 'alerts-panel',
      title: t('tour.alerts-panel.title'),
      content: t('tour.alerts-panel.content'),
      position: 'bottom-right',
      target: '.stat-card.critical',
      tab: null
    },
    {
      id: 'language-selector',
      title: t('tour.language.title'),
      content: t('tour.language.content'),
      position: 'bottom-left',
      target: '.language-selector-btn',
      tab: null
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

  // Highlight target element and switch tabs if needed
  useEffect(() => {
    if (isOpen && isRunning && currentStep >= 0) {
      const step = tourSteps[currentStep];
      
      // Switch tab if this step requires a specific tab
      if (step.tab && onNavigate) {
        onNavigate(step.tab);
        // Wait for tab to render before highlighting
        setTimeout(() => {
          if (step.target) {
            highlightElement(step.target);
          }
        }, 200);
      } else if (step.target) {
        highlightElement(step.target);
      }
    }
    return () => {
      removeHighlight();
    };
  }, [currentStep, isOpen, isRunning]);

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
    const padding = 4; // align with highlight ring (4px shadow)
    setSpotlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
  };

  // Keep spotlight and tooltip aligned on scroll/resize
  useEffect(() => {
    const handleRealign = () => {
      if (highlightedElement) {
        updateSpotlight(highlightedElement);
        // Force tooltip position recalculation
        setForceUpdate(prev => prev + 1);
      }
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

  // Calculate position based on target element with viewport awareness
  // Note: Using fixed positioning, so we use rect values directly (viewport-relative)
  const getStepPosition = () => {
    if (!currentStepData.target) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const rect = targetElement.getBoundingClientRect();
    const gap = 20; // Gap between tooltip and target element

    switch (currentStepData.position) {
      case 'top':
        // Position above the element (fixed positioning uses viewport coords)
        return {
          bottom: window.innerHeight - rect.top + gap,
          left: rect.left + (rect.width / 2),
          transform: 'translateX(-50%)'
        };
      case 'top-right':
        return {
          bottom: window.innerHeight - rect.top + gap,
          right: window.innerWidth - rect.right
        };
      case 'top-left':
        return {
          bottom: window.innerHeight - rect.top + gap,
          left: rect.left
        };
      case 'bottom':
        return {
          top: rect.bottom + gap,
          left: rect.left + (rect.width / 2),
          transform: 'translateX(-50%)'
        };
      case 'bottom-right':
        return {
          top: rect.bottom + gap,
          right: window.innerWidth - rect.right
        };
      case 'bottom-left':
        return {
          top: rect.bottom + gap,
          left: rect.left
        };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const stepPosition = getStepPosition();

  return (
    <div 
      className="guided-tour-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="tour-step-title"
      onKeyDown={handleKeyDown}
      ref={overlayRef}
      tabIndex={-1}
    >
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
            <div className="tour-step-header-right">
              <span className="tour-step-counter">{currentStep + 1} of {tourSteps.length}</span>
              <button 
                className="tour-step-close-btn" 
                onClick={onClose}
                aria-label="Close tour"
                title="Close tour"
              >
                ×
              </button>
            </div>
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