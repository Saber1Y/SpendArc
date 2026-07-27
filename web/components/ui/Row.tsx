import type {ReactNode} from "react";

/** A list row - used for action history. Clean, spacious, hover. */
export function Row({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-3 transition hover:bg-surface-hover/50 ${className}`}
    >
      {children}
    </div>
  );
}

/** Simple skeleton bar for loading states. */
export function Skeleton({className = ""}: {className?: string}) {
  return <div className={`animate-pulse rounded-lg bg-surface-hover ${className}`} />;
}
