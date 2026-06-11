// Reconstruction — dependency impact + an executable regeneration plan.
// Opens only on demand. "▶ Запустити" runs the plan step-by-step:
//   Очікує → Регенерується → Готово, with a progress bar and a final summary.
(function () {
  const { useEffect: useRcEffect, useState: useRcState, useRef: useRcRef } = React;
  const LAYER_LABEL = { narrative: "Наратив", director: "Режисер" };
  const ST_TXT = { pending: "Очікує", running: "Регенерується…", done: "Готово" };

  function KindRow({ kind, items }) {
    const I = Ic[WKIND.icon[kind]] || Ic.dot;
    return (
      <div className="rc-kind">
        <div className="rc-kind__h"><I />{WKIND.label[kind]}<span className="rc-kind__n">{items.length}</span></div>
        <div className="rc-kind__items">
          {items.map((it) => <span className="rc-pill" key={it.id || it.n}>{it.title || it.name || ("Сцена " + it.n)}</span>)}
        </div>
      </div>
    );
  }

  function ReconstructionOverlay({ type, id, onClose }) {
    const [changeId, setChangeId] = useRcState("property");
    const plan = wReconstructionPlan(type, id, changeId);
    const e = plan.change.entity;
    const aff = wAffected(type, id);
    const imp = plan.affected;
    const steps = plan.steps;
    const ct = plan.changeType, sev = plan.severity;

    const [phase, setPhase] = useRcState("plan");           // plan | running | done
    const [statuses, setStatuses] = useRcState(() => steps.map(() => "pending"));
    const cancelled = useRcRef(false);
    const rootRef = useRcRef(null);

    useRcEffect(() => {
      const prev = document.activeElement;
      const el = rootRef.current;
      const first = el && el.querySelector("button:not([disabled])");
      if (first) first.focus();
      const onKey = (ev) => {
        if (ev.key !== "Tab" || !el) return;
        const items = [...el.querySelectorAll("button:not([disabled]), select, input, [tabindex]:not([tabindex='-1'])")].filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const f = items[0], l = items[items.length - 1];
        if (ev.shiftKey && document.activeElement === f) { ev.preventDefault(); l.focus(); }
        else if (!ev.shiftKey && document.activeElement === l) { ev.preventDefault(); f.focus(); }
      };
      el && el.addEventListener("keydown", onKey);
      return () => { el && el.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus(); };
    }, []);

    // changing the change-type re-derives the plan → reset execution
    useRcEffect(() => { setStatuses(steps.map(() => "pending")); setPhase("plan"); }, [changeId]);

    useRcEffect(() => {
      const k = (ev) => { if (ev.key === "Escape" && phase !== "running") onClose(); };
      window.addEventListener("keydown", k);
      return () => window.removeEventListener("keydown", k);
    }, [onClose, phase]);
    useRcEffect(() => () => { cancelled.current = true; }, []);

    const doneCount = statuses.filter((s) => s === "done").length;
    const regenTotal = steps.reduce((a, s) => a + s.count, 0);
    const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

    function run() {
      if (phase !== "plan" || !steps.length) return;
      setPhase("running");
      let i = 0;
      const tick = () => {
        if (cancelled.current) return;
        if (i >= steps.length) { setPhase("done"); return; }
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? "running" : s)));
        setTimeout(() => {
          if (cancelled.current) return;
          setStatuses((prev) => prev.map((s, idx) => (idx === i ? "done" : s)));
          i += 1;
          setTimeout(tick, 170);
        }, 560 + Math.min(steps[i].count, 6) * 40);
      };
      tick();
    }

    return ReactDOM.createPortal(
      <div className="rc-scrim" onClick={() => phase !== "running" && onClose()}>
        <div className="rc" role="dialog" aria-modal="true" aria-label="Реконструкція всесвіту" ref={rootRef} onClick={(ev) => ev.stopPropagation()}>
          <header className="rc__head">
            <div>
              <span className="rc__k">{phase === "done" ? "Реконструкцію завершено" : phase === "running" ? "Реконструкція виконується" : "Симуляція реконструкції"}</span>
              <h2 className="rc__title">{wTitle(type, e)}</h2>
            </div>
            <button className="rc__x" type="button" onClick={onClose} aria-label="Закрити" disabled={phase === "running"}><Ic.x /></button>
          </header>

          <div className="rc__body">
            <div className="rc-flow">
              <div className="rc-flow__node is-source"><span className="rc-flow__lbl">Зміна канону</span><span className="rc-flow__v">{wTitle(type, e)}</span></div>
              <span className="rc-flow__arr">↓</span>
              <div className="rc-flow__node"><span className="rc-flow__lbl">Зачеплений наратив</span><span className="rc-flow__v">{imp.narrative}</span></div>
              <span className="rc-flow__arr">↓</span>
              <div className="rc-flow__node"><span className="rc-flow__lbl">Зачеплений режисер</span><span className="rc-flow__v">{imp.director}</span></div>
            </div>

            {/* Change Analysis — the kind of change picks the strategy */}
            <div className="rc-change">
              <div className="rc-change__lbl">Аналіз зміни · яка саме зміна сталася?</div>
              <div className="rc-change__opts">
                {WCHANGES.map((c) => {
                  const CI = Ic[c.icon] || Ic.dot;
                  return (
                    <button key={c.id} type="button" className={`rc-co ${changeId === c.id ? "is-on" : ""}`}
                      disabled={phase !== "plan"} onClick={() => setChangeId(c.id)}>
                      <CI />{c.label}
                    </button>
                  );
                })}
              </div>
              <div className="rc-strategy">
                <span className={`rc-sev rc-sev--${ct.severity}`}>{sev.label} реконструкція</span>
                <span className="rc-strategy__t"><b>{ct.strategy}</b> — {ct.desc}</span>
              </div>
            </div>

            {phase === "done" ? (
              <div className="rc-summary rc-summary--done">
                <Ic.check /><span>Реконструйовано <b>{regenTotal}</b> елементів за <b>{steps.length}</b> кроків. Всесвіт узгоджено.</span>
              </div>
            ) : (
              <div className="rc-summary">
                <Ic.layers /><span>Зміна цієї сутності зачепить <b>{imp.total}</b> елементів контенту</span>
              </div>
            )}

            {/* affected by layer — collapsed once running to focus on progress */}
            {phase === "plan" && ["narrative", "director"].map((layer) => {
              const kinds = Object.keys(aff[layer]).filter((k) => aff[layer][k].length);
              if (!kinds.length) return null;
              return (
                <section className="rc-layer" key={layer}>
                  <h3 className="rc-layer__h">{LAYER_LABEL[layer]}<span className="rc-layer__n">{imp[layer]}</span></h3>
                  {kinds.map((k) => <KindRow key={k} kind={k} items={aff[layer][k]} />)}
                </section>
              );
            })}

            <section className="rc-plan">
              <div className="rc-plan__top">
                <h3 className="rc-plan__h"><Ic.wand />План реконструкції</h3>
                {phase !== "plan" && <span className="rc-plan__prog mono">{doneCount}/{steps.length}</span>}
              </div>
              {phase !== "plan" && <div className="rc-bar"><div className="rc-bar__fill" style={{ width: pct + "%" }} /></div>}
              {steps.length === 0 && <div className="rc-empty">{changeId === "add" ? "Додавання сутності не зачіпає наявний контент — реконструкція не потрібна." : "За цією стратегією немає що реконструювати."}</div>}
              <ol className="rc-steps">
                {steps.map((s, idx) => {
                  const I = Ic[s.icon] || Ic.dot;
                  const st = statuses[idx];
                  return (
                    <li className={`rc-step rc-step--${st}`} key={s.order}>
                      <span className="rc-step__no">{st === "done" ? "✓" : String(s.order).padStart(2, "0")}</span>
                      <span className={`rc-step__layer rc-step__layer--${s.layer}`}>{LAYER_LABEL[s.layer]}</span>
                      <span className="rc-step__act"><I />{s.action}</span>
                      <span className="rc-step__cnt">×{s.count}</span>
                      <span className={`rc-step__st rc-step__st--${st}`}>{st === "running" && <span className="rc-spin" />}{ST_TXT[st]}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="rc__foot">
              <span className="rc__note">
                {phase === "done" ? "Демо-конвеєр: контент позначено як узгоджений (нічого не видалено)."
                  : phase === "running" ? "Виконується послідовно: Наратив → Режисер."
                  : "Прев'ю режиму Universe Reconstruction. Запуск — демонстраційний."}
              </span>
              {phase === "done" ? (
                <button className="rc__run rc__run--done" type="button" onClick={onClose}><Ic.check />Готово · Закрити</button>
              ) : (
                <button className={`rc__run ${steps.length && phase === "plan" ? "rc__run--go" : ""}`} type="button"
                  onClick={run} disabled={!steps.length || phase === "running"}>
                  {phase === "running" ? <><span className="rc-spin rc-spin--lg" />Реконструкція…</> : <>▶ Запустити реконструкцію</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  window.ReconstructionOverlay = ReconstructionOverlay;
}());
