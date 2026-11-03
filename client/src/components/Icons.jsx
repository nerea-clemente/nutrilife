const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const I = (d) => (props) => <svg viewBox="0 0 24 24" {...P} {...props}>{d}</svg>;

export const IcToday = I(<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 10h8M8 14h5" /></>);
export const IcCalendar = I(<><rect x="3.5" y="5" width="17" height="15" rx="3.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const IcCycle = I(<><path d="M12 3.5c3.5 4 6 7.2 6 10.2a6 6 0 0 1-12 0c0-3 2.5-6.2 6-10.2z" /></>);
export const IcChart = I(<><path d="M4 19h16" /><path d="M5 15l4-5 4 3 6-7" /></>);
export const IcMore = I(<><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>);
export const IcLeft = I(<path d="M14.5 6l-6 6 6 6" />);
export const IcRight = I(<path d="M9.5 6l6 6-6 6" />);
export const IcCamera = I(<><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.3" /></>);
export const IcPlus = I(<path d="M12 5v14M5 12h14" />);
export const IcClose = I(<path d="M6 6l12 12M18 6L6 18" />);
export const IcTrash = I(<><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5" /></>);
export const IcClock = I(<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>);
export const IcPhoto = I(<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8.5 8.5" /></>);
export const IcDownload = I(<><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></>);
export const IcBell = I(<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>);
export const IcTag = I(<><path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z" /><circle cx="8" cy="9" r="1.4" /></>);
export const IcGear = I(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>);
export const IcLogout = I(<><path d="M14 4.5H6.5A2 2 0 0 0 4.5 6.5v11a2 2 0 0 0 2 2H14M10 12h10M16.5 8.5 20 12l-3.5 3.5" /></>);
export const IcShare = I(<><path d="M12 15V4M8 7.5l4-3.5 4 3.5M6 11v7.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V11" /></>);

export function Bottle({ fill = 1, size = 34 }) {
  // fill: 0, 0.5 o 1
  const id = `b${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox="0 0 20 40" width={size * 0.5} height={size} aria-hidden="true">
      <defs>
        <clipPath id={id}><path d="M6 6h8v3c2.5 1.5 4 3.5 4 6.5V35a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V15.5C2 12.5 3.5 10.5 6 9z" /></clipPath>
      </defs>
      <rect x="6.5" y="1.5" width="7" height="4.5" rx="1.5" fill="#33666B" />
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="20" height="40" fill="#EEF4F3" />
        <rect x="0" y={38 - 30 * fill} width="20" height={30 * fill + 2} fill="#7FB3B8" />
      </g>
      <path d="M6 6h8v3c2.5 1.5 4 3.5 4 6.5V35a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V15.5C2 12.5 3.5 10.5 6 9z" fill="none" stroke="#33666B" strokeWidth="1.4" />
    </svg>
  );
}
