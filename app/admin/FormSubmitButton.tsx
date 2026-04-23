'use client';

import { useFormStatus } from 'react-dom';

type FormSubmitButtonProps = {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
  confirmMessage?: string;
};

export function FormSubmitButton({
  children,
  className,
  pendingLabel,
  confirmMessage,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      aria-disabled={pending}
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel ?? 'Guardando...' : children}
    </button>
  );
}
