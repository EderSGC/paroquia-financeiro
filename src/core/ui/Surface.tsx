import type { ElementType, HTMLAttributes } from "react";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
  className?: string;
}

export function Surface({ as: Component = "div", className = "", ...props }: SurfaceProps) {
  return <Component className={`surface ${className}`} {...props} />;
}
