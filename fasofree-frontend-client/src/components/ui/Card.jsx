import React from 'react';
import { cn } from '../../utils/cn';

const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'transition-all duration-200';
  
  const variants = {
    default: 'bg-background-card border border-border-light',
    elevated: 'bg-background-card border border-border-light shadow-elevated',
    outlined: 'bg-background-primary border border-border-medium',
    flat: 'bg-background-secondary',
  };
  
  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
