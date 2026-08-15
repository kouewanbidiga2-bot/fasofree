import React from 'react';

// ─────────────────────────────────────────────────────────
// 1. COMPOSANT : STATCARD
// ─────────────────────────────────────────────────────────
export const StatCard = ({ label, value, icon: Icon, trend, color = '#3B82F6', loading = false, className = '' }) => {
  return (
    <div className={`stat-card bg-background-card border border-border-light rounded-xl p-5 hover:shadow-lg transition-shadow ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}
        >
          {Icon && <Icon size={18} style={{ color }} strokeWidth={1.5} />}
        </div>
        
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${
            trend >= 0 ? 'text-status-success' : 'text-status-error'
          }`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      
      <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      
      {loading ? (
        <div className="h-7 w-24 bg-background-secondary rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-text-primary">
          {value ?? '—'}
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// 2. COMPOSANT : STATUSBADGE 
// ─────────────────────────────────────────────────────────
export const StatusBadge = ({ status, statusConfig = {} }) => {
  const config = statusConfig[status] || {
    label: status,
    color: 'gray',
    dot: '#A09890'
  };

  const colorClasses = {
    success: 'bg-status-successBg text-status-success border-status-success/30',
    warning: 'bg-status-warningBg text-status-warning border-status-warning/30',
    error: 'bg-status-errorBg text-status-error border-status-error/30',
    info: 'bg-status-infoBg text-status-info border-status-info/30',
    processing: 'bg-status-processingBg text-status-processing border-status-processing/30',
    gray: 'bg-background-secondary text-text-secondary border-border-light',
  };

  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${colorClasses[config.color] || colorClasses.gray}`}>
      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────
// 3. COMPOSANT : LOADINGSKELETON
// ─────────────────────────────────────────────────────────
export const LoadingSkeleton = ({ className = '', height = 'h-4', width = 'w-full' }) => {
  return (
    <div className={`bg-background-secondary rounded animate-pulse ${height} ${width} ${className}`} />
  );
};

// ─────────────────────────────────────────────────────────
// 4. COMPOSANT : ORDERSTATUSSTEPPER
// ─────────────────────────────────────────────────────────
export const OrderStatusStepper = ({ currentStatus, steps }) => {
  const currentStepIndex = steps.findIndex(step => step.key === currentStatus);

  return (
    <div className="flex items-center justify-between py-4">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isPending = index > currentStepIndex;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isCompleted 
                    ? 'bg-status-success border-status-success text-white' 
                    : isCurrent 
                      ? 'bg-accent-primary border-accent-primary text-white' 
                      : 'bg-background-secondary border-border-light text-text-tertiary'
                }`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <p className={`text-[10px] font-semibold mt-2 text-center ${
                isCurrent ? 'text-accent-primary' : 'text-text-secondary'
              }`}>
                {step.label}
              </p>
            </div>
            
            {index < steps.length - 1 && (
              <div 
                className={`h-0.5 flex-1 mx-2 transition-colors ${
                  isCompleted ? 'bg-status-success' : 'bg-border-light'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// 5. COMPOSANT : EMPTYSTATE
// ─────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mb-4">
          <Icon size={32} className="text-text-tertiary" strokeWidth={1} />
        </div>
      )}
      <h3 className="text-base font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-4">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
};

export default StatCard;