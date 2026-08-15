import React from 'react';
import { cn } from '../../utils/cn';

const Input = ({
  label,
  error,
  icon: Icon,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-tertiary">
            <Icon size={20} />
          </div>
        )}
        <input
          className={cn(
            'w-full px-4 py-3 bg-background-secondary border border-border-light',
            'text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-accent-primary',
            'transition-all duration-300',
            Icon && 'pl-12',
            error && 'border-status-error focus:ring-status-error',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-status-error">{error}</p>
      )}
    </div>
  );
};

export default Input;
