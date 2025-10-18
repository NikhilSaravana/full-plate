import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Translation data
const translations = {
  en: {
    // Navigation
    'nav.overview': 'Overview',
    'nav.food-intake': 'Food Intake',
    'nav.distribution': 'Distribution',
    'nav.myplate': 'MyPlate Analysis',
    'nav.reports': 'Reports',
    
    // Header
    'header.title': 'FullPlate',
    'header.welcome': 'Welcome to FullPlate!',
    'header.welcome-description': 'Get started by clicking the "Food Intake" tab above to record your current food inventory. This system will help you track food donations, manage distributions, and ensure nutritional balance.',
    'header.sign-out': 'Sign Out',
    
    // Stats
    'stats.total-inventory': 'Total Inventory',
    'stats.distributed-today': 'Distributed Today',
    'stats.myplate-compliance': 'MyPlate Compliance',
    'stats.clients-served-today': 'Clients Served Today',
    'stats.critical-alerts': 'Critical Alerts',
    'stats.warnings': 'Warnings',
    
    // Dashboard
    'dashboard.current-inventory': 'Current Inventory Distribution',
    'dashboard.show-in': 'Show in:',
    'dashboard.pounds': 'Pounds',
    'dashboard.cases': 'Cases',
    'dashboard.pallets': 'Pallets',
    'dashboard.critical-alerts-warnings': 'Critical Alerts & Warnings',
    'dashboard.no-alerts': 'No critical alerts at this time',
    'dashboard.no-alerts-desc': 'All systems are operating within normal parameters.',
    'dashboard.quick-actions': 'Quick Actions',
    'dashboard.add-inventory': 'Add Inventory',
    'dashboard.check-myplate': 'Check MyPlate',
    'dashboard.manage-inventory': 'Manage Inventory',
    'dashboard.reset-all-data': 'Reset All Data',
    'dashboard.recent-distributions': 'Recent Distributions',
    'dashboard.no-distributions': 'No distributions recorded yet',
    'dashboard.no-distributions-desc': 'Start recording distributions to track outgoing food.',
    'dashboard.view-all-distributions': 'View All Distributions',
    
    // Food Categories
    'category.dairy': 'DAIRY',
    'category.grain': 'GRAIN',
    'category.protein': 'PROTEIN',
    'category.fruit': 'FRUIT',
    'category.vegetables': 'VEG',
    'category.produce': 'PRODUCE',
    'category.misc': 'MISC',
    
    // Status
    'status.over': 'OVER',
    'status.under': 'UNDER',
    'status.good': 'GOOD',
    
    // Units
    'units.lbs': 'lbs',
    'units.cases': 'cases',
    'units.pallets': 'pallets',
    
    // Empty states
    'empty.no-inventory': 'No Inventory Data Yet',
    'empty.no-inventory-desc': 'Get started by adding your current inventory using the "Data Entry" tab.',
    'empty.start-adding': 'Start Adding Inventory',
    
    // Buttons
    'btn.check': 'Check',
    'btn.reset-today': 'Reset Today',
    'btn.reset': 'Reset',
    'btn.start-tour': 'Start Tour',
    'btn.maybe-later': 'Maybe Later',
    'btn.previous': 'Previous',
    'btn.next': 'Next',
    'btn.finish': 'Finish',
    
    // Tour
    'tour.modal.title': 'Take a Guided Tour',
    'tour.modal.welcome': 'Ready to explore FullPlate?',
    'tour.modal.description': 'This interactive tour will walk you through the main features and help you get started with managing your food bank inventory.',
    'tour.modal.feature1': 'Dashboard Overview',
    'tour.modal.feature2': 'Food Intake Tracking',
    'tour.modal.feature3': 'Distribution Management',
    'tour.modal.feature4': 'Nutritional Analysis',
    'tour.modal.start': 'Start Tour',
    'tour.modal.skip': 'Maybe Later',
    'tour.welcome.title': 'Welcome to FullPlate!',
    'tour.welcome.content': 'This guided tour will help you understand the key features of your food bank management system.',
    'tour.stats.title': 'Dashboard Overview',
    'tour.stats.content': 'This is your main dashboard where you can see inventory levels, distribution metrics, and critical alerts at a glance.',
    'tour.navigation.title': 'Main Navigation',
    'tour.navigation.content': 'Use these tabs to navigate between different sections: Overview, Food Intake, Distribution, MyPlate Analysis, and Reports.',
    'tour.food-intake.title': 'Food Intake Tab',
    'tour.food-intake.content': 'Click here to record incoming food donations. You can add single items or bulk donations by category.',
    'tour.distribution.title': 'Distribution Tab',
    'tour.distribution.content': 'Click here to track outgoing food distributions to clients. Record recipient details, quantities, and client demographics.',
    'tour.myplate.title': 'MyPlate Analysis Tab',
    'tour.myplate.content': 'Click here to monitor your nutritional balance according to USDA MyPlate guidelines.',
    'tour.reports.title': 'Reports Tab',
    'tour.reports.content': 'Click here to generate detailed reports on your food bank operations and performance metrics.',
    'tour.language.title': 'Language Selector',
    'tour.language.content': 'Switch between English and Spanish using this language selector.',
    
    // Language
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.select': 'Select Language',
    
    // Breadcrumbs
    'breadcrumb.food-bank-manager': 'Food Bank Manager',
    'breadcrumb.inventory-management': 'Inventory Management',
    'breadcrumb.unit-configuration': 'Unit Configuration',
    'breadcrumb.analytics': 'Analytics',
    'breadcrumb.distribution-history': 'Distribution History',
    
    // Empty States
    'empty.no-data': 'No data available',
    'empty.loading': 'Loading...',
    'empty.error': 'Error loading data',
    
    // Form Labels
    'form.item-name': 'Item Name',
    'form.category': 'Category',
    'form.quantity': 'Quantity',
    'form.unit': 'Unit',
    'form.weight': 'Weight',
    'form.notes': 'Notes',
    'form.submit': 'Submit',
    'form.cancel': 'Cancel',
    'form.save': 'Save',
    'form.edit': 'Edit',
    'form.delete': 'Delete',
    'form.add': 'Add',
    'form.remove': 'Remove',
    
    // Status Messages
    'status.loading': 'Loading...',
    'status.saving': 'Saving...',
    'status.saved': 'Saved',
    'status.error': 'Error',
    'status.success': 'Success',
    'status.warning': 'Warning',
    'status.info': 'Information',
    
    // Actions
    'action.add-item': 'Add Item',
    'action.add-inventory': 'Add Inventory',
    'action.view-details': 'View Details',
    'action.edit-item': 'Edit Item',
    'action.remove-item': 'Remove Item',
    'action.export-data': 'Export Data',
    'action.import-data': 'Import Data',
    'action.reset-data': 'Reset Data',
    'action.clear-all': 'Clear All',
    
    // Tooltips
    'tooltip.system-health': 'System Health Check',
    'tooltip.reset-today': 'Reset Today\'s Metrics',
    'tooltip.reset-all': 'Reset All Data',
    'tooltip.take-tour': 'Take a guided tour',
    
    // Messages
    'message.confirm-delete': 'Are you sure you want to delete this item?',
    'message.confirm-reset': 'Are you sure you want to reset all data? This action cannot be undone.',
    'message.data-saved': 'Data saved successfully',
    'message.data-exported': 'Data exported successfully',
    'message.data-imported': 'Data imported successfully',
    'message.no-items': 'No items found',
    'message.no-distributions': 'No distributions recorded',
    'message.no-reports': 'No reports available',
    
    // Sub-tabs and Sections
    'subtabs.single-entry': 'Single Entry',
    'subtabs.bulk-import': 'Bulk Import',
    'subtabs.inventory-management': 'Inventory Management',
    'subtabs.unit-configuration': 'Unit Configuration',
    'subtabs.analytics': 'Analytics',
    'subtabs.distribution-history': 'Distribution History',
    'sections.analytics-insights': 'Analytics & Insights',
    'sections.distribution-history-analytics': 'Distribution History & Analytics',
    'sections.general-information': 'General Information',
    'sections.unit-configuration-manager': 'Unit Configuration Manager'
  },
  es: {
    // Navigation
    'nav.overview': 'Resumen',
    'nav.food-intake': 'Ingreso de Alimentos',
    'nav.distribution': 'Distribución',
    'nav.myplate': 'Análisis MyPlate',
    'nav.reports': 'Reportes',
    
    // Header
    'header.title': 'FullPlate',
    'header.welcome': '¡Bienvenido a FullPlate!',
    'header.welcome-description': 'Comience haciendo clic en la pestaña "Ingreso de Alimentos" arriba para registrar su inventario actual de alimentos. Este sistema le ayudará a rastrear donaciones de alimentos, gestionar distribuciones y asegurar el equilibrio nutricional.',
    'header.sign-out': 'Cerrar Sesión',
    
    // Stats
    'stats.total-inventory': 'Inventario Total',
    'stats.distributed-today': 'Distribuido Hoy',
    'stats.myplate-compliance': 'Cumplimiento MyPlate',
    'stats.clients-served-today': 'Clientes Atendidos Hoy',
    'stats.critical-alerts': 'Alertas Críticas',
    'stats.warnings': 'Advertencias',
    
    // Dashboard
    'dashboard.current-inventory': 'Distribución de Inventario Actual',
    'dashboard.show-in': 'Mostrar en:',
    'dashboard.pounds': 'Libras',
    'dashboard.cases': 'Cajas',
    'dashboard.pallets': 'Pallets',
    'dashboard.critical-alerts-warnings': 'Alertas Críticas y Advertencias',
    'dashboard.no-alerts': 'No hay alertas críticas en este momento',
    'dashboard.no-alerts-desc': 'Todos los sistemas están operando dentro de parámetros normales.',
    'dashboard.quick-actions': 'Acciones Rápidas',
    'dashboard.add-inventory': 'Agregar Inventario',
    'dashboard.check-myplate': 'Verificar MyPlate',
    'dashboard.manage-inventory': 'Gestionar Inventario',
    'dashboard.reset-all-data': 'Restablecer Todos los Datos',
    'dashboard.recent-distributions': 'Distribuciones Recientes',
    'dashboard.no-distributions': 'Aún no se han registrado distribuciones',
    'dashboard.no-distributions-desc': 'Comience a registrar distribuciones para rastrear alimentos salientes.',
    'dashboard.view-all-distributions': 'Ver Todas las Distribuciones',
    
    // Food Categories
    'category.dairy': 'LÁCTEOS',
    'category.grain': 'GRANOS',
    'category.protein': 'PROTEÍNA',
    'category.fruit': 'FRUTAS',
    'category.vegetables': 'VERDURAS',
    'category.produce': 'PRODUCTOS',
    'category.misc': 'MISC',
    
    // Status
    'status.over': 'SOBRE',
    'status.under': 'BAJO',
    'status.good': 'BUENO',
    
    // Units
    'units.lbs': 'lbs',
    'units.cases': 'cajas',
    'units.pallets': 'pallets',
    
    // Empty states
    'empty.no-inventory': 'Aún No Hay Datos de Inventario',
    'empty.no-inventory-desc': 'Comience agregando su inventario actual usando la pestaña "Entrada de Datos".',
    'empty.start-adding': 'Comenzar a Agregar Inventario',
    
    // Buttons
    'btn.check': 'Verificar',
    'btn.reset-today': 'Restablecer Hoy',
    'btn.reset': 'Restablecer',
    'btn.start-tour': 'Iniciar Recorrido',
    'btn.maybe-later': 'Tal Vez Más Tarde',
    'btn.previous': 'Anterior',
    'btn.next': 'Siguiente',
    'btn.finish': 'Finalizar',
    
    // Tour
    'tour.modal.title': 'Hacer un Recorrido Guiado',
    'tour.modal.welcome': '¿Listo para explorar FullPlate?',
    'tour.modal.description': 'Este recorrido interactivo le guiará a través de las características principales y le ayudará a comenzar a gestionar el inventario de su banco de alimentos.',
    'tour.modal.feature1': 'Resumen del Tablero',
    'tour.modal.feature2': 'Seguimiento de Ingreso de Alimentos',
    'tour.modal.feature3': 'Gestión de Distribución',
    'tour.modal.feature4': 'Análisis Nutricional',
    'tour.modal.start': 'Iniciar Recorrido',
    'tour.modal.skip': 'Tal Vez Más Tarde',
    'tour.welcome.title': '¡Bienvenido a FullPlate!',
    'tour.welcome.content': 'Este recorrido guiado le ayudará a entender las características principales de su sistema de gestión de banco de alimentos.',
    'tour.stats.title': 'Resumen del Tablero',
    'tour.stats.content': 'Este es su panel principal donde puede ver niveles de inventario, métricas de distribución y alertas críticas de un vistazo.',
    'tour.navigation.title': 'Navegación Principal',
    'tour.navigation.content': 'Use estas pestañas para navegar entre diferentes secciones: Resumen, Ingreso de Alimentos, Distribución, Análisis MyPlate y Reportes.',
    'tour.food-intake.title': 'Pestaña de Ingreso de Alimentos',
    'tour.food-intake.content': 'Haga clic aquí para registrar donaciones de alimentos entrantes. Puede agregar artículos individuales o donaciones a granel por categoría.',
    'tour.distribution.title': 'Pestaña de Distribución',
    'tour.distribution.content': 'Haga clic aquí para rastrear distribuciones de alimentos salientes a clientes. Registre detalles de destinatarios, cantidades y demografía de clientes.',
    'tour.myplate.title': 'Pestaña de Análisis MyPlate',
    'tour.myplate.content': 'Haga clic aquí para monitorear su equilibrio nutricional según las pautas de MyPlate del USDA.',
    'tour.reports.title': 'Pestaña de Reportes',
    'tour.reports.content': 'Haga clic aquí para generar reportes detallados sobre las operaciones de su banco de alimentos y métricas de rendimiento.',
    'tour.language.title': 'Selector de Idioma',
    'tour.language.content': 'Cambie entre inglés y español usando este selector de idioma.',
    
    // Language
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.select': 'Seleccionar Idioma',
    
    // Breadcrumbs
    'breadcrumb.food-bank-manager': 'Administrador de Banco de Alimentos',
    'breadcrumb.inventory-management': 'Gestión de Inventario',
    'breadcrumb.unit-configuration': 'Configuración de Unidades',
    'breadcrumb.analytics': 'Analíticas',
    'breadcrumb.distribution-history': 'Historial de Distribución',
    
    // Empty States
    'empty.no-data': 'No hay datos disponibles',
    'empty.loading': 'Cargando...',
    'empty.error': 'Error al cargar datos',
    
    // Form Labels
    'form.item-name': 'Nombre del Artículo',
    'form.category': 'Categoría',
    'form.quantity': 'Cantidad',
    'form.unit': 'Unidad',
    'form.weight': 'Peso',
    'form.notes': 'Notas',
    'form.submit': 'Enviar',
    'form.cancel': 'Cancelar',
    'form.save': 'Guardar',
    'form.edit': 'Editar',
    'form.delete': 'Eliminar',
    'form.add': 'Agregar',
    'form.remove': 'Quitar',
    
    // Status Messages
    'status.loading': 'Cargando...',
    'status.saving': 'Guardando...',
    'status.saved': 'Guardado',
    'status.error': 'Error',
    'status.success': 'Éxito',
    'status.warning': 'Advertencia',
    'status.info': 'Información',
    
    // Actions
    'action.add-item': 'Agregar Artículo',
    'action.add-inventory': 'Agregar Inventario',
    'action.view-details': 'Ver Detalles',
    'action.edit-item': 'Editar Artículo',
    'action.remove-item': 'Quitar Artículo',
    'action.export-data': 'Exportar Datos',
    'action.import-data': 'Importar Datos',
    'action.reset-data': 'Restablecer Datos',
    'action.clear-all': 'Limpiar Todo',
    
    // Tooltips
    'tooltip.system-health': 'Verificación de Salud del Sistema',
    'tooltip.reset-today': 'Restablecer Métricas de Hoy',
    'tooltip.reset-all': 'Restablecer Todos los Datos',
    'tooltip.take-tour': 'Hacer un recorrido guiado',
    
    // Messages
    'message.confirm-delete': '¿Está seguro de que desea eliminar este artículo?',
    'message.confirm-reset': '¿Está seguro de que desea restablecer todos los datos? Esta acción no se puede deshacer.',
    'message.data-saved': 'Datos guardados exitosamente',
    'message.data-exported': 'Datos exportados exitosamente',
    'message.data-imported': 'Datos importados exitosamente',
    'message.no-items': 'No se encontraron artículos',
    'message.no-distributions': 'No se registraron distribuciones',
    'message.no-reports': 'No hay reportes disponibles',
    
    // Sub-tabs and Sections
    'subtabs.single-entry': 'Entrada Individual',
    'subtabs.bulk-import': 'Importación Masiva',
    'subtabs.inventory-management': 'Gestión de Inventario',
    'subtabs.unit-configuration': 'Configuración de Unidades',
    'subtabs.analytics': 'Analíticas',
    'subtabs.distribution-history': 'Historial de Distribución',
    'sections.analytics-insights': 'Analíticas e Información',
    'sections.distribution-history-analytics': 'Historial de Distribución y Analíticas',
    'sections.general-information': 'Información General',
    'sections.unit-configuration-manager': 'Administrador de Configuración de Unidades'
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('fullplate-language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage);
      localStorage.setItem('fullplate-language', newLanguage);
    }
  };

  const t = (key) => {
    return translations[language][key] || key;
  };

  const value = {
    language,
    changeLanguage,
    t,
    translations
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
