import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BrandLogo({ className, size = "md" }: BrandLogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <h1 className={cn("font-black tracking-tight text-foreground", sizeClasses[size], className)}>
      Connect<span className="text-foreground">Sphere</span>
    </h1>
  );
}

// Keep old Logo export for backward compatibility but deprecated
export function Logo() {
  return null;
}
