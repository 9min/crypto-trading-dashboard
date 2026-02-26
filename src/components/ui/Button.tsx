'use client';

// =============================================================================
// Button Component
// =============================================================================
// Reusable button primitive with variant and size support.
// Uses existing CSS custom properties for consistent theming.
// =============================================================================

import { memo, forwardRef, type ButtonHTMLAttributes } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// -----------------------------------------------------------------------------
// Style Maps
// -----------------------------------------------------------------------------

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-background hover:bg-accent-hover',
  secondary:
    'border border-border text-foreground hover:border-border-hover hover:bg-background-tertiary',
  ghost: 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary',
  danger: 'bg-sell/10 text-sell hover:bg-sell/20',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 text-xs px-2',
  md: 'h-8 text-sm px-3',
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'secondary', size = 'md', className = '', disabled, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  }),
);

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export type { ButtonProps, ButtonVariant, ButtonSize };
