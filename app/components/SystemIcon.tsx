import type { ReactNode } from "react";

export type SystemIconName =
  | "bell" | "bike" | "calendar" | "cart" | "category" | "check" | "chef" | "chair"
  | "chart" | "clock" | "coffee" | "delivery" | "dollar" | "eye" | "eyeOff"
  | "mail" | "package" | "phone" | "pin" | "star" | "store" | "thumbDown" | "thumbUp"
  | "user" | "users" | "x";

const ICON_PATHS: Record<SystemIconName, ReactNode> = {
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l2 3h-4l-4 8-4-8h5M5.5 17.5 9 9"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  cart: <><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 8H5"/></>,
  category: <><path d="M4 4h7v7H4zM15 4h5v5h-5zM15 13h5v7h-5zM4 15h7v5H4z"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chef: <><path d="M6 13a4 4 0 1 1 1-7.9 5 5 0 0 1 10 0A4 4 0 1 1 18 13v7H6z"/><path d="M6 16h12"/></>,
  chair: <><path d="M5 12V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M4 12h16v5H4zM6 17v4M18 17v4"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  coffee: <><path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 10h2a2 2 0 1 1 0 4h-2M7 3v2M11 3v2M15 3v2"/></>,
  delivery: <><path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="18" cy="19" r="1.5"/></>,
  dollar: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3-.5"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  package: <><path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5M12 13v8"/></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3.2a2 2 0 0 1-.6 1.7L7.6 10a16 16 0 0 0 6.4 6.4l1.4-1.4a2 2 0 0 1 1.7-.6l3.2.5a2 2 0 0 1 1.7 2z"/>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z"/>,
  store: <><path d="M3 10h18l-2-6H5zM5 10v10h14V10M9 20v-6h6v6"/><path d="M3 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 4 0"/></>,
  thumbDown: <><path d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM7 10l3-7a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1h-6z" transform="rotate(180 12 12)"/></>,
  thumbUp: <><path d="M7 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM7 10l3-7a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1h-6z"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  x: <path d="m18 6-12 12M6 6l12 12"/>,
};

export default function SystemIcon({ name, size = 18, className, style }: {
  name: SystemIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flexShrink: 0, ...style }}>{ICON_PATHS[name]}</svg>;
}
