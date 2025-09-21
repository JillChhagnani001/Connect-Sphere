import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" />
      <path d="M12 12a4.95 4.95 0 0 0 4.95-4.95A4.95 4.95 0 0 0 12 2.1a4.95 4.95 0 0 0-4.95 4.95c0 .24.02.48.05.71" fill="hsl(var(--sidebar-background))" stroke="none" />
      <path d="M12 12a4.95 4.95 0 0 1-4.95 4.95A4.95 4.95 0 0 1 2.1 12a4.95 4.95 0 0 1 4.95-4.95c.24 0 .48.02.71.05" fill="hsl(var(--sidebar-background))" stroke="none" />
    </svg>
  );
}
