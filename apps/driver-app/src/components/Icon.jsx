const paths = {
  menu: "M4 7h16M4 12h16M4 17h16",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0",
  power: "M12 3v8M6.4 6.6a8 8 0 1 0 11.2 0",
  home: "M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Zm0 0 11-3v3M16 13h1",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  chat: "M4 5h16v11H9l-5 4V5Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  star: "M12 3.5 14.6 9l5.9.6-4.4 4 1.3 5.9L12 16.6l-5.4 2.9 1.3-5.9-4.4-4L9.4 9 12 3.5Z",
  logout: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9"
};

export default function Icon({ name, size = 22, fill = "none" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
