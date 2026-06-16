// Minimal line icons (Lucide-style). Stroke inherits currentColor.
const Ic = {};
function mk(name, body) {
  Ic[name] = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" {...props}>{body}</svg>
  );
}

mk("clapper", <>
  <path d="M3 9.5 21 9.5 21 19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
  <path d="M3 9.5 4.4 4.7a1 1 0 0 1 1.2-.7l13.6 3.2a1 1 0 0 1 .7 1.2l-.3 1.1" />
  <path d="m7.5 5 -1.3 4.2 M12 6 10.7 9.5 M16.5 7 15.2 10" />
</>);
mk("users", <>
  <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6S14 16 14.5 19" />
  <path d="M16 5.2A3 3 0 0 1 16 11 M17 14.6c2 .5 3.4 2 3.8 4.4" />
</>);
mk("map", <>
  <path d="m9 4-6 2.2v13.6L9 18l6 2 6-2.2V4.2L15 6 9 4z" />
  <path d="M9 4v14M15 6v14" />
</>);
mk("brain", <>
  <path d="M12 5.5a3 3 0 0 0-5.6-1.1A2.7 2.7 0 0 0 4 9a2.7 2.7 0 0 0 .6 4.4A2.8 2.8 0 0 0 7 18a3 3 0 0 0 5 1.2z" />
  <path d="M12 5.5a3 3 0 0 1 5.6-1.1A2.7 2.7 0 0 1 20 9a2.7 2.7 0 0 1-.6 4.4A2.8 2.8 0 0 1 17 18a3 3 0 0 1-5 1.2z" />
  <path d="M12 5.5v14" />
</>);
mk("film", <>
  <rect x="3" y="4" width="18" height="16" rx="1.6" />
  <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4M7 12h10" />
</>);
mk("camera", <>
  <path d="M4 8h3l1.4-2h7.2L18 8h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
  <circle cx="12" cy="13" r="3.4" />
</>);
mk("copy", <>
  <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
</>);
mk("check", <path d="m5 12 4.5 4.5L19 7" />);
mk("plus", <path d="M12 5v14M5 12h14" />);
mk("sparkle", <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />);
mk("clock", <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
mk("wand", <>
  <path d="M5 19 16 8M13.5 5.5 18.5 10.5" /><path d="M19 4l.6 1.6L21 6l-1.4.6L19 8l-.6-1.4L17 6l1.4-.4z" />
</>);
mk("edit", <>
  <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17z" /><path d="M14 7l3 3" />
</>);
mk("eye", <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
mk("chevron", <path d="m9 6 6 6-6 6" />);
mk("x", <path d="M6 6 18 18M18 6 6 18" />);
mk("link", <><path d="M9 15 15 9" /><path d="M11 6.5 12.6 5a3.5 3.5 0 0 1 5 5l-1.6 1.5M13 17.5 11.4 19a3.5 3.5 0 0 1-5-5l1.6-1.5" /></>);
mk("caret", <path d="m6 9 6 6 6-6" />);
mk("arrowOut", <><path d="M7 17 17 7M9 7h8v8" /></>);
mk("dot", <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />);
mk("circle", <circle cx="12" cy="12" r="7.5" />);
mk("hourglass", <>
  <path d="M7 4h10M7 20h10" /><path d="M7 4c0 4 5 5 5 8s-5 4-5 8M17 4c0 4-5 5-5 8s5 4 5 8" />
</>);
mk("alert", <>
  <path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17.2v.1" />
</>);
mk("layers", <>
  <path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5M3 16.5l9 5 9-5" />
</>);
mk("pin", <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>);
mk("palette", <>
  <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.7 0-1 .8-1.6 1.7-1.6H17a4 4 0 0 0 4-4 8.7 8.7 0 0 0-9-10.7z" />
  <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="11" cy="7.5" r="1" fill="currentColor" stroke="none" />
  <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
</>);
mk("globe", <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" /></>);
mk("rocket", <>
  <path d="M5 14c-1.5 1-2 4-2 4s3-.5 4-2M9 19l-4-4c1-5 4-9 9-11 2 5-1 11-5 15z" />
  <circle cx="14.5" cy="9.5" r="1.4" />
</>);
mk("signal", <path d="M5 19v-3M10 19v-7M15 19v-11M20 19V5" />);
mk("book", <><path d="M4 5.5A2 2 0 0 1 6 4h6v15H6a2 2 0 0 0-2 1.5z" /><path d="M20 5.5A2 2 0 0 0 18 4h-6v15h6a2 2 0 0 1 2 1.5z" /></>);
mk("tree", <>
  <path d="M12 21v-6" />
  <path d="M12 15c-3 0-5-2-5-5a4.3 4.3 0 0 1 1.5-3.3A4 4 0 0 1 12 3a4 4 0 0 1 3.5 3.7A4.3 4.3 0 0 1 17 10c0 3-2 5-5 5z" />
  <path d="M12 11 9.5 8.5M12 12.5l2.5-2.5" />
</>);
mk("grid", <><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></>);
mk("image", <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 18 5-5 4 3.5L17 12l3 3.5" /></>);
mk("cpu", <><rect x="6" y="6" width="12" height="12" rx="2.5" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none" /></>);

window.Ic = Ic;
