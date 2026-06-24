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
  ),
  bell: (props: IconProps) => (
    <Icon {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></Icon>
  ),
  output: (props: IconProps) => (
    <Icon {...props}><path d="M4 19V9l8-5 8 5v10Z" /><path d="M8 19v-5h8v5M9 10h.01M12 10h.01M15 10h.01" /></Icon>
  ),
  achievement: (props: IconProps) => (
    <Icon {...props}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m4 7 6-4 6 6 5-5" /></Icon>
  ),
  reject: (props: IconProps) => (
    <Icon {...props}><path d="M4 4h16v16H4z" /><path d="m8 8 8 8M16 8l-8 8" /></Icon>
  ),
  scale: (props: IconProps) => (
    <Icon {...props}><path d="M12 3v18M5 7h14M5 7l-3 6h6L5 7ZM19 7l-3 6h6l-3-6Z" /></Icon>
  ),
  percent: (props: IconProps) => (
    <Icon {...props}><path d="m19 5-14 14" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></Icon>
  ),
  database: (props: IconProps) => (
    <Icon {...props}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></Icon>
  ),
  quality: (props: IconProps) => (
    <Icon {...props}><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7Z" /><path d="m9 12 2 2 4-4" /></Icon>
  ),
  arrowRight: (props: IconProps) => (
    <Icon {...props}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
  ),
  copy: (props: IconProps) => (
    <Icon {...props}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Icon>
  ),
  calendar: (props: IconProps) => (
    <Icon {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon>
  ),
  filter: (props: IconProps) => (
    <Icon {...props}><path d="M4 5h16M7 12h10M10 19h4" /></Icon>
  ),
  more: (props: IconProps) => (
    <Icon {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Icon>
  ),
  audit: (props: IconProps) => (
    <Icon {...props}><path d="M9 5h10M9 12h10M9 19h10" /><path d="m3 5 1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2" /></Icon>
  ),
  health: (props: IconProps) => (
    <Icon {...props}><path d="M3 12h4l2-7 4 14 2-7h6" /></Icon>
  )
};
