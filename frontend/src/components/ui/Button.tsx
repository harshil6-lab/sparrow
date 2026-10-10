import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../Icon";

export type ButtonVariant = "primary" | "secondary" | "sun" | "quiet" | "google" | "danger";
export type ButtonSize = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Pill shape (fully rounded) — used for the "Enter Sparrow" / Skip pills. */
  pill?: boolean;
  wide?: boolean;
  icon?: IconName;
  iconSize?: number;
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "primary-button",
  secondary: "quiet-button",
  sun: "sun-button",
  quiet: "quiet-button",
  google: "google-button",
  danger: "danger-button",
};

/**
 * The single button primitive. Every variant maps onto a class from the
 * design's stylesheet so radii/colour/height stay consistent everywhere.
 */
export function Button({
  variant = "primary",
  size = "default",
  pill = false,
  wide = false,
  icon,
  iconSize,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = [
    VARIANT_CLASS[variant],
    "ui-button",
    size === "sm" ? "ui-button-sm" : "",
    pill ? "ui-button-pill" : "",
    wide ? "wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...rest}>
      {children}
      {icon ? <Icon name={icon} size={iconSize ?? 19} /> : null}
    </button>
  );
}
