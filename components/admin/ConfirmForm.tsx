"use client";

import type { ReactNode } from "react";

/**
 * The `.js-confirm-form` pattern every admin page used: a native POST form whose submit is gated
 * by the browser confirm() dialog reading `form.dataset.confirm`. Ported as a client component so
 * the marker class and data-confirm attribute stay identical while the behaviour is preserved.
 * The form posts natively to `action`; the route handler answers with a Post/Redirect/Get 303.
 */
export default function ConfirmForm({
  action,
  confirm: confirmText,
  className,
  children,
}: {
  action: string;
  confirm: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      method="POST"
      action={action}
      className={className ? `js-confirm-form ${className}` : "js-confirm-form"}
      data-confirm={confirmText}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
