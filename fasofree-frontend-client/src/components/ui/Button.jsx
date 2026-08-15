import React from 'react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../theme/ThemeContext';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  className,
  style = {},
  ...props
}) => {
  const { themeColor } = useTheme();
  // No change
  const baseStyles = 'font-semibold rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-background-primary disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  
  // Base classes without color specifics for primary and outline
  const variants = {
    primary: 'text-white border border-transparent shadow-subtle hover:-translate-y-0.5',
    secondary: 'bg-background-card text-text-primary hover:bg-background-tertiary border border-border-medium',
    outline: 'bg-transparent border',
    ghost: 'bg-transparent text-text-primary hover:bg-background-tertiary border border-transparent',
    text: 'bg-transparent text-text-primary border-none px-0 hover:opacity-80',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // Dynamic styles based on variant and themeColor
  const dynamicStyle = { ...style };
  if (variant === 'primary') {
    dynamicStyle.backgroundColor = themeColor;
    dynamicStyle.color = 'white';
  } else if (variant === 'outline') {
    dynamicStyle.color = themeColor;
    dynamicStyle.borderColor = themeColor;
  } else if (variant === 'text') {
    dynamicStyle.color = themeColor;
  }

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      style={dynamicStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Chargement...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
