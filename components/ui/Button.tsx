import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "outline" | "ghost";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper-card hover:opacity-90",
  outline: "border border-ink text-ink hover:bg-ink/5",
  ghost: "text-ink-soft hover:text-ink",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className = "", variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={`${base} ${variants[variant]} ${className}`}
    {...props}
  />
));
Button.displayName = "Button";
