// Extra line icons for the World Tree nodes & sections — added onto the
// shared window.Ic registry defined in ws-icons.jsx.
(function () {
  const Ic = window.Ic;
  function mk(name, body) {
    Ic[name] = (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
           strokeLinecap="round" strokeLinejoin="round" {...props}>{body}</svg>
    );
  }
  // Events — flame / battlefield
  mk("flame", <>
    <path d="M12 3c.7 3.2-1.8 4.3-2.8 6.2-1.6 3 .3 6.8 2.8 6.8s4.4-3.1 3.1-6c-.5-1.1-1.2-1.6-.9-3.4" />
    <path d="M12 21a5 5 0 0 0 5-5c0-2.2-1.3-3.6-2.2-5" />
    <path d="M12 21a5 5 0 0 1-5-5" />
  </>);
  // Dialogue — speech
  mk("chat", <>
    <path d="M5 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 4V6a1 1 0 0 1 1-1z" />
    <path d="M8 9h8M8 12h5" />
  </>);
  // Factions — banner / crest
  mk("crest", <>
    <path d="M12 3 5 5.4V12c0 4.2 3 7 7 9 4-2 7-4.8 7-9V5.4z" />
    <path d="M12 7v9M8.5 10.5h7" />
  </>);
  // Artifacts — magical relic / gem
  mk("gem", <>
    <path d="M6 4h12l3 5-9 11L3 9z" />
    <path d="M3 9h18M9 4 6 9l6 11M15 4l3 5-6 11" />
  </>);
  // World bible / scroll
  mk("scroll", <>
    <path d="M6 4h11a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H6" />
    <path d="M6 4a2 2 0 0 0-2 2v1.5h4M6 20a2 2 0 0 1-2-2" />
    <path d="M9 9h6M9 12.5h6M9 16h4" />
  </>);
  // Director clapper already exists as "clapper"; add a feather/pen for Book
  mk("feather", <>
    <path d="M19 5c-3 0-9 2-12 8-1.3 2.6-2 5-2 5s2.4-.7 5-2c6-3 8-9 9-11z" />
    <path d="M5 19 11 13M16 8l-4 1 1-4" />
  </>);
  mk("edit", <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>);
  mk("check", <path d="M20 6 9 17l-5-5" />);
  mk("plus", <><path d="M12 5v14M5 12h14" /></>);
}());
