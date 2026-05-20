"use client";

import { cn } from "@/lib/cn";
import { APP_LOGO_SRC, APP_NAME } from "@/lib/brand";

export interface JusicLogoProps {
  size?: number;
  className?: string;
  variant?: "full" | "mark";
  animated?: boolean;
  title?: string;
}

export function JusicLogo({
  size = 40,
  className,
  animated = true,
  title = APP_NAME
}: JusicLogoProps) {
  return (
    <img
      src={APP_LOGO_SRC}
      width={size}
      height={size}
      alt={title}
      title={title}
      decoding="async"
      draggable={false}
      className={cn(animated && "jusic-logo-float", "jusic-logo", className)}
    />
  );
}
