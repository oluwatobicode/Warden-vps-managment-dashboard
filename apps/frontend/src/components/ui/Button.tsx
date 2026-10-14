import type { ComponentProps } from "react";
import { Link, type LinkProps } from "react-router";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-white",
  secondary: "border border-fieldb bg-card text-strong hover:bg-hover",
  ghost: "text-muted-warm hover:text-strong",
  danger: "bg-crit text-white hover:bg-crit-hover",
};

const SIZE: Record<Size, string> = {
  md: "rounded-xl px-[18px] py-3 text-[12.5px]",
  lg: "w-full rounded-xl px-4 py-[15px] text-[13px]",
};

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks (double submits). */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}

/** A link that looks like a Button. Never put a <button> inside a <Link>. */
export function ButtonLink({ variant = "primary", size = "md", className = "", ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest} />;
}
