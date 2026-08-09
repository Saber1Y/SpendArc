import {Spinner} from "./Spinner";

/** Full-section loader shown while a page or section resolves its data. */
export function PageLoader({label = "Loading...", fill = false}: {label?: string; fill?: boolean}) {
  return (
    <div className={`flex items-center justify-center ${fill ? "min-h-[70vh]" : "py-24"}`}>
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-6 w-6 text-accent" />
        <div className="text-[13px] text-text-muted">{label}</div>
      </div>
    </div>
  );
}
