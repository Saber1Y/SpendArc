import type {ButtonHTMLAttributes, ReactNode} from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "accent" | "danger" | "ghost";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface-muted text-text-primary border border-border hover:bg-surface-hover",
  accent: "bg-accent text-white hover:bg-accent-hover",
  danger: "bg-state-blocked text-white hover:bg-state-blocked/90",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-hover",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-4 py-2 text-[13px]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition motion-safe:active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap";

type CommonProps = {variant?: Variant; size?: Size; className?: string; children: ReactNode};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  external = false,
  children,
}: CommonProps & {href: string; external?: boolean}) {
  const cls = `${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
