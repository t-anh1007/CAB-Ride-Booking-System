const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const paths = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  activity: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13" /><path d="M12 8c-2-4-6-4-6-1.5S9 8 12 8c3 0 6 1 6-1.5S14 4 12 8z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  locate: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  house: <><path d="M4 10l8-6 8 6v10H4z" /><path d="M10 20v-5h4v5" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  close: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2M3 10h18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>
};
export function Icon({ name, size = 22, ...props }) {
  return <svg {...base} width={size} height={size} {...props}>{paths[name]}</svg>;
}

const vehicles = {
  bike: <><circle cx="12" cy="30" r="7" /><circle cx="46" cy="30" r="7" /><path d="M12 30l10-12h12l12 12M30 18l-4-6h-6M38 18l3-6h6" /></>,
  standard: <><path d="M6 30v-7l6-9h30l8 9h4v7" /><path d="M10 23h44M24 14v9" /><circle cx="17" cy="31" r="5" /><circle cx="45" cy="31" r="5" /></>,
  premium: <><path d="M4 30v-6l8-9h28l10 9h6v6" /><path d="M8 24h48" /><circle cx="17" cy="31" r="5" /><circle cx="47" cy="31" r="5" /></>,
  suv: <><path d="M5 30V14h34l9 9h9v7" /><path d="M5 22h52M22 14v8M37 14v8" /><circle cx="17" cy="31" r="5" /><circle cx="46" cy="31" r="5" /></>
};
export function VehicleIcon({ type }) {
  return <svg width="52" height="32" viewBox="0 0 62 38" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{vehicles[type]}</svg>;
}

export function CarIllustration() {
  return <svg className="cx-car-art" viewBox="0 0 240 120" aria-hidden="true">
    <g fill="#dfe8e3"><rect x="20" y="30" width="22" height="60" rx="3" /><rect x="46" y="14" width="18" height="76" rx="3" /><rect x="170" y="22" width="20" height="68" rx="3" /><rect x="194" y="40" width="24" height="50" rx="3" /></g>
    <ellipse cx="120" cy="100" rx="88" ry="7" fill="#10231d" opacity=".12" />
    <path d="M38 88V72c0-5 3-8 8-9l22-4 20-17c4-3 8-5 14-5h40c7 0 12 2 17 7l17 16 18 4c5 1 8 5 8 10v14z" fill="#18c88b" />
    <path d="M92 58l14-14c3-3 6-4 10-4h20v18zM144 40h4c5 0 9 2 12 5l13 13h-29z" fill="#cdeee1" />
    <path d="M38 80h164" stroke="#0e9e6c" strokeWidth="3" />
    <circle cx="76" cy="90" r="13" fill="#10231d" /><circle cx="76" cy="90" r="5" fill="#e8efeb" />
    <circle cx="170" cy="90" r="13" fill="#10231d" /><circle cx="170" cy="90" r="5" fill="#e8efeb" />
  </svg>;
}
