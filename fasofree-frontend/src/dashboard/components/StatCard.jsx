import React from 'react';

// ─────────────────────────────────────────────────────────
// 1. COMPOSANT : STATCARD
// Style « bloc Hanpiz » : pastille encre + titre à côté, valeur XXL.
// Le prop `color` est conserve pour compatibilite des appelsants mais
// n'est plus utilise visuellement (palette beige/terracotta verrouillee).
// ─────────────────────────────────────────────────────────
export const StatCard = ({ label, value, icon: Icon, trend, color, loading = false, className = '' }) => {
  return (
    <div className={`rounded-card border border-border-light bg-background-card p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#241F1B]">
          {Icon && <Icon size={17} strokeWidth={2} className="text-white" />}
        </span>
        <p className="min-w-0 truncate text-[13.5px] font-bold text-text-primary">{label}</p>
        {trend !== undefined && (
          <span className={`ml-auto shrink-0 text-xs font-bold ${trend >= 0 ? 'text-status-success' : 'text-status-error'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      <p className="mt-4 text-[30px] font-extrabold leading-none tracking-tight text-text-primary">
        {loading ? (
          <span className="inline-block h-7 w-24 rounded bg-background-secondary animate-pulse" />
        ) : (
          value ?? '—'
        )}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// 2. COMPOSANT : STATUSBADGE
// Pilule arrondie teintee + pastille de statut (jamais de MAJUSCULES).
// ─────────────────────────────────────────────────────────
export const StatusBadge = ({ status, statusConfig = {} }) => {
  const config = statusConfig[status] || {
    label: status,
    color: 'gray',
    dot: '#9B9286'
  };

  const colorClasses = {
    success: 'bg-status-successBg text-status-success border-status-success/25',
    warning: 'bg-status-warningBg text-status-warning border-status-warning/25',
    error: 'bg-status-errorBg text-status-error border-status-error/25',
    info: 'bg-status-infoBg text-status-info border-status-info/25',
    processing: 'bg-status-processingBg text-status-processing border-status-processing/25',
    gray: 'bg-background-secondary text-text-secondary border-border-light',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${colorClasses[config.color] || colorClasses.gray}`}>
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: config.dot }} />
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