import React from 'react';
import { cn } from '../../utils/cn';

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-300';
  
  const variants = {
    default: 'bg-background-tertiary text-text-secondary',
    primary: 'bg-accent-primary text-white',
    success: 'bg-status-success text-white',
    warning: 'bg-status-warning text-white',
    error: 'bg-status-error text-white',
    info: 'bg-status-info text-white',
  };
  
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  
  return (
    <span
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
