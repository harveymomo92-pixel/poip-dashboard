import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  overview: (props: IconProps) => (
    <Icon {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>
  ),
  downtime: (props: IconProps) => (
    <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
  ),
  import: (props: IconProps) => (
    <Icon {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></Icon>
  ),
  parser: (props: IconProps) => (
    <Icon {...props}><path d="M4 5h16v11H7l-3 3Z" /><path d="M8 9h8M8 12h5" /></Icon>
  ),
  sync: (props: IconProps) => (
    <Icon {...props}><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 8" /></Icon>
  ),
  target: (props: IconProps) => (
    <Icon {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icon>
  ),
  users: (props: IconProps) => (
    <Icon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>
  ),
  menu: (props: IconProps) => (
    <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
  ),
  collapse: (props: IconProps) => (
    <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>
  ),
  expand: (props: IconProps) => (
    <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>
  ),
  close: (props: IconProps) => (
    <Icon {...props}><path d="M18 6 6 18M6 6l12 12" /></Icon>
  ),
  chevron: (props: IconProps) => (
    <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>
  ),
  refresh: (props: IconProps) => (
    <Icon {...props}><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 8" /></Icon>
  ),
  check: (props: IconProps) => (
    <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
  ),
  alert: (props: IconProps) => (
    <Icon {...props}><path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Icon>
  ),
  inbox: (props: IconProps) => (
    <Icon {...props}><path d="M4 4h16v16H4z" /><path d="M4 14h4l2 3h4l2-3h4" /></Icon>
  ),
  logout: (props: IconProps) => (
    <Icon {...props}><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h7v18h-7" /></Icon>
  ),
  upload: (props: IconProps) => (
    <Icon {...props}><path d="M12 21V9" /><path d="m7 14 5-5 5 5" /><path d="M4 5h16" /></Icon>
  )
};
