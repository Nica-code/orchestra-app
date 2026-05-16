'use client';

// Thin wrapper over Button — kept as a named component for clarity at call sites.
import { Button } from './Button';

interface Props {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
}

export function LoadingButton({ loading, disabled, children, onClick, variant = 'primary', className, type = 'button' }: Props) {
  return (
    <Button loading={loading} disabled={disabled} onClick={onClick} variant={variant} className={className} type={type}>
      {children}
    </Button>
  );
}
