import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full rounded border border-rule bg-paper-card px-3 py-2 text-sm text-ink outline-none focus:border-ink ${className}`}
    {...props}
  />
));
Input.displayName = "Input";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-medium text-ink-soft"
    >
      {children}
    </label>
  );
}
