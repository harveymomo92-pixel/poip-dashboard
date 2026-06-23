import { type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = "button", ...props }: ButtonProps) {
  return <button className={clsx("poip-button", className)} type={type} {...props} />;
}
