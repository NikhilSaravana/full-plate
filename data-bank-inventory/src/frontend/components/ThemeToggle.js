import React from 'react';
import { useTheme } from '../../backend/contexts/ThemeContext';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button onClick={toggleTheme} className="theme-toggle" title={t('theme.toggle-theme')}>
      <span className="theme-icon">
        {theme === 'light' ? '☀️' : '🌙'}
      </span>
      <span className="theme-name">
        {theme === 'light' ? t('theme.light-mode') : t('theme.dark-mode')}
      </span>
    </button>
  );
};

export default ThemeToggle;
