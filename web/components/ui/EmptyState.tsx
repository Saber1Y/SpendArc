import type {ReactNode} from "react";

/**
 * Empty state with icon, title, description, and optional CTA.
 * Used across dashboard pages so every "nothing here yet" looks the same
 * and always tells the user what to do next.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-accent">
          {icon}
        </div>
      )}
      <div className="text-[15px] font-semibold text-text-primary">{title}</div>
      {description && <div className="mt-1.5 max-w-[340px] text-[13px] text-text-muted">{description}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
