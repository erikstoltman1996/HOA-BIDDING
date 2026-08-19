import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Shared top bar for every logged-in page. Clicking the logo goes home, so
 * subpages no longer need their own "← back" link — a breadcrumb-style
 * second line shows the org and current section instead.
 */
export function AppHeader({
  orgName,
  userLabel,
  section,
  maxWidthClassName = "max-w-5xl",
}: {
  orgName: string;
  userLabel: string;
  section?: string;
  maxWidthClassName?: string;
}) {
  return (
    <header className="border-b-2 border-ink bg-paper-card">
      <div className={`mx-auto flex items-center justify-between px-4 py-4 sm:px-8 ${maxWidthClassName}`}>
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-soft sm:inline">{userLabel}</span>
          <SignOutButton />
        </div>
      </div>
      <div className={`mx-auto px-4 pb-3 sm:px-8 ${maxWidthClassName}`}>
        <p className="text-xs text-ink-soft">
          {orgName}
          {section && (
            <>
              <span className="mx-1.5 text-rule">›</span>
              {section}
            </>
          )}
        </p>
      </div>
    </header>
  );
}
