// Reconstruction — dependency impact + an executable regeneration plan.
// Opens only on demand. "▶ Запустити" runs the plan step-by-step:
//   Очікує → Регенерується → Готово, with a progress bar and a final summary.
(function () {
  const { useEffect: useRcEffect, useState: useRcState, useRef: useRcRef } = React;

  // Helper to get translations
  function t(key, replacements) {
    let text = window.__i18n ? window.__i18n.t(key) : key;
    if (replacements) {
      Object.keys(replacements).forEach(k => {
        text = text.replace(new RegExp('{' + k + '}', 'g'), replacements[k]);
      });
    }
    return text;
  }

  const LAYER_LABEL = {
    narrative: () => t('reconstruct.layer.narrative'),
    director: () => t('reconstruct.layer.director')
  };
  const ST_TXT = {
    pending: () => t('reconstruct.status.pending'),
    running: () => t('reconstruct.status.running'),
    done: () => t('reconstruct.status.done'),
    skipped: () => t('reconstruct.status.skipped')
  };

  // Word-level diff (LCS) for the "було → стане" view. Common prefix/suffix are
  // trimmed first, so the DP only covers the edited middle of the scene.
  function wordDiff(a, b) {
    const A = a.split(/(\s+)/), B = b.split(/(\s+)/);
    let p = 0; while (p < A.length && p < B.length && A[p] === B[p]) p++;
    let s = 0; while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
    const a2 = A.slice(p, A.length - s), b2 = B.slice(p, B.length - s);
    const n = a2.length, m = b2.length, out = [];
    const push = (type, text) => { const l = out[out.length - 1]; if (l && l.type === type) l.text += text; else if (text) out.push({ type, text }); };
    push("eq", A.slice(0, p).join(""));
    if (n * m > 4e6) { push("del", a2.join("")); push("ins", b2.join("")); }
    else {
      const W = m + 1, dp = new Uint16Array((n + 1) * W);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        dp[i * W + j] = a2[i] === b2[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (a2[i] === b2[j]) { push("eq", a2[i]); i++; j++; }
        else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) push("del", a2[i++]);
        else push("ins", b2[j++]);
      }
      while (i < n) push("del", a2[i++]);
      while (j < m) push("ins", b2[j++]);
    }
    push("eq", A.slice(A.length - s).join(""));
    return out;
  }

  // Long unchanged stretches are clipped to their edges so the edits stand out.
  function clipEq(text, first, last) {
    const K = 160;
    if (text.length <= 2 * K + 40) return text;
    if (first) return "… " + text.slice(-K);
    if (last) return text.slice(0, K) + " …";
    return text.slice(0, K) + " … " + text.slice(-K);
  }

  function DiffView({ before, after }) {
    const parts = React.useMemo(() => wordDiff(before, after), [before, after]);
    return (
      <div className="rc-diff">
        {parts.map((p, i) => p.type === "eq"
          ? <span key={i}>{clipEq(p.text, i === 0, i === parts.length - 1)}</span>
          : <span key={i} className={p.type === "ins" ? "rc-diff__ins" : "rc-diff__del"}>{p.text}</span>)}
      </div>
    );
  }

  function KindRow({ kind, items }) {
    const I = Ic[WKIND.icon[kind]] || Ic.dot;
    return (
      <div className="rc-kind">
        <div className="rc-kind__h"><I />{WKIND.label[kind]}<span className="rc-kind__n">{items.length}</span></div>
        <div className="rc-kind__items">
          {items.map((it) => <span className="rc-pill" key={it.id || it.n}>{it.title || it.name || (t('reconstruct.scene') + " " + it.n)}</span>)}
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

    // Real mode: a loaded Firestore project → scenes are rewritten by AI and
    // reviewed here. Without one (demo world) the pipeline stays a simulation.
    const projectId = window.__firebaseCanon && window.__firebaseCanon.projectId;
    const isReal = !!(projectId && window.__firebaseScenes && window.__firebaseScenes.reconstructScene);
    const [note, setNote] = useRcState("");
    const [results, setResults] = useRcState({}); // sceneId → { title, st, before, after, error }
    const [fatal, setFatal] = useRcState(null);

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
    useRcEffect(() => { setStatuses(steps.map(() => "pending")); setPhase("plan"); setResults({}); setFatal(null); }, [changeId]);

    useRcEffect(() => {
      const k = (ev) => { if (ev.key === "Escape" && phase !== "running") onClose(); };
      window.addEventListener("keydown", k);
      return () => window.removeEventListener("keydown", k);
    }, [onClose, phase]);
    useRcEffect(() => () => { cancelled.current = true; }, []);

    const doneCount = statuses.filter((s) => s === "done").length;
    const regenTotal = steps.reduce((a, s) => a + s.count, 0);
    const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

    const setStep = (idx, st) => setStatuses((prev) => prev.map((s, k) => (k === idx ? st : s)));
    const putResult = (sid, r) => setResults((prev) => ({ ...prev, [sid]: { ...prev[sid], ...r } }));

    async function applyScene(sid, before, after) {
      await window.__firebaseScenes.applyReconstruction(projectId, sid, after, before, { type, id, change: changeId });
      const sc = (WORLD.scenes || []).find((x) => x.id === sid);
      if (sc) sc.text = after;
    }
    async function accept(sid) {
      const r = results[sid];
      try { await applyScene(sid, r.before, r.after); putResult(sid, { st: "applied" }); }
      catch (err) { putResult(sid, { st: "error", error: err.message }); }
    }
    async function acceptAll() {
      for (const sid of Object.keys(results)) if (results[sid].st === "review") await accept(sid);
    }

    // Scenes are reconstructed one by one; each scene's own mode decides what
    // happens to the proposal: review (default) → diff, auto → applied, pinned → untouched.
    async function runReal() {
      setPhase("running"); setFatal(null);
      for (let idx = 0; idx < steps.length; idx++) {
        const step = steps[idx];
        if (step.kind !== "scenes") { setStep(idx, "skipped"); continue; }
        setStep(idx, "running");
        for (const it of step.items) {
          if (cancelled.current) return;
          const sc = (WORLD.scenes || []).find((x) => x.id === it.id);
          if (!sc) continue;
          const mode = (sc.reconstruction && sc.reconstruction.mode) || "review";
          putResult(sc.id, { title: it.title, st: mode === "pinned" ? "pinned" : "running" });
          if (mode === "pinned") continue;
          const r = await window.__firebaseScenes.reconstructScene(projectId, sc.id, type, id, changeId, note.trim());
          if (cancelled.current) return;
          if (!r.success) {
            putResult(sc.id, { st: "error", error: r.error });
            if (r.code === "OUT_OF_TOKENS" || r.code === "PLAN_REQUIRED" || r.requiresSubscription) {
              setFatal(r.error); setStep(idx, "skipped"); setPhase("done"); return;
            }
            continue;
          }
          if (r.unchanged) { putResult(sc.id, { st: "unchanged" }); continue; }
          const before = sc.text || "";
          putResult(sc.id, { st: "review", before, after: r.proposedText });
          if (mode === "auto") {
            try { await applyScene(sc.id, before, r.proposedText); putResult(sc.id, { st: "applied" }); }
            catch (err) { putResult(sc.id, { st: "error", error: err.message }); }
          }
        }
        setStep(idx, "done");
      }
      setPhase("done");
    }

    const rv = Object.values(results);
    const rvCount = (st) => rv.filter((r) => r.st === st).length;

    function run() {
      if (phase !== "plan" || !steps.length) return;
      if (isReal) { runReal(); return; }
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
        <div className="rc" role="dialog" aria-modal="true" aria-label={t('reconstruct.title')} ref={rootRef} onClick={(ev) => ev.stopPropagation()}>
          <header className="rc__head">
            <div>
              <span className="rc__k">{phase === "done" ? t('reconstruct.completedTitle') : phase === "running" ? t('reconstruct.runningTitle') : isReal ? t('reconstruct.title') : t('reconstruct.simulationTitle')}</span>
              <h2 className="rc__title">{wTitle(type, e)}</h2>
            </div>
            <button className="rc__x" type="button" onClick={onClose} aria-label={t('reconstruct.close')} disabled={phase === "running"}><Ic.x /></button>
          </header>

          <div className="rc__body">
            <div className="rc-flow">
              <div className="rc-flow__node is-source"><span className="rc-flow__lbl">{t('reconstruct.canonChange')}</span><span className="rc-flow__v">{wTitle(type, e)}</span></div>
              <span className="rc-flow__arr">↓</span>
              <div className="rc-flow__node"><span className="rc-flow__lbl">{t('reconstruct.affectedNarrative')}</span><span className="rc-flow__v">{imp.narrative}</span></div>
              <span className="rc-flow__arr">↓</span>
              <div className="rc-flow__node"><span className="rc-flow__lbl">{t('reconstruct.affectedDirector')}</span><span className="rc-flow__v">{imp.director}</span></div>
            </div>

            {/* Change Analysis — the kind of change picks the strategy */}
            <div className="rc-change">
              <div className="rc-change__lbl">{t('reconstruct.changeAnalysis')}</div>
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
                <span className={`rc-sev rc-sev--${ct.severity}`}>{sev.label} {t('reconstruct.reconstruction')}</span>
                <span className="rc-strategy__t"><b>{ct.strategy}</b> — {ct.desc}</span>
              </div>
              {isReal && steps.length > 0 && (
                <textarea className="rc-note" rows={2} maxLength={500} value={note} disabled={phase !== "plan"}
                  onChange={(ev) => setNote(ev.target.value)}
                  placeholder={t('reconstruct.notePlaceholder')} aria-label={t('reconstruct.notePlaceholder')} />
              )}
            </div>

            {phase === "done" ? (
              <div className="rc-summary rc-summary--done">
                <Ic.check /><span dangerouslySetInnerHTML={{ __html: isReal
                  ? t('reconstruct.reviewSummary', { review: rvCount("review"), applied: rvCount("applied"), unchanged: rvCount("unchanged") })
                  : t('reconstruct.completedSummary', { total: regenTotal, steps: steps.length }) }} />
              </div>
            ) : (
              <div className="rc-summary">
                <Ic.layers /><span dangerouslySetInnerHTML={{ __html: t('reconstruct.impactSummary', { total: imp.total }) }} />
              </div>
            )}

            {/* affected by layer — collapsed once running to focus on progress */}
            {phase === "plan" && ["narrative", "director"].map((layer) => {
              const kinds = Object.keys(aff[layer]).filter((k) => aff[layer][k].length);
              if (!kinds.length) return null;
              return (
                <section className="rc-layer" key={layer}>
                  <h3 className="rc-layer__h">{LAYER_LABEL[layer]()}<span className="rc-layer__n">{imp[layer]}</span></h3>
                  {kinds.map((k) => <KindRow key={k} kind={k} items={aff[layer][k]} />)}
                </section>
              );
            })}

            <section className="rc-plan">
              <div className="rc-plan__top">
                <h3 className="rc-plan__h"><Ic.wand />{t('reconstruct.planTitle')}</h3>
                {phase !== "plan" && <span className="rc-plan__prog mono">{doneCount}/{steps.length}</span>}
              </div>
              {phase !== "plan" && <div className="rc-bar"><div className="rc-bar__fill" style={{ width: pct + "%" }} /></div>}
              {steps.length === 0 && <div className="rc-empty">{changeId === "add" ? t('reconstruct.emptyAdd') : t('reconstruct.emptyDefault')}</div>}
              <ol className="rc-steps">
                {steps.map((s, idx) => {
                  const I = Ic[s.icon] || Ic.dot;
                  const st = statuses[idx];
                  return (
                    <li className={`rc-step rc-step--${st}`} key={s.order}>
                      <span className="rc-step__no">{st === "done" ? "✓" : String(s.order).padStart(2, "0")}</span>
                      <span className={`rc-step__layer rc-step__layer--${s.layer}`}>{LAYER_LABEL[s.layer]()}</span>
                      <span className="rc-step__act"><I />{s.action}</span>
                      <span className="rc-step__cnt">×{s.count}</span>
                      <span className={`rc-step__st rc-step__st--${st}`}>{st === "running" && <span className="rc-spin" />}{ST_TXT[st]()}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            {isReal && rv.length > 0 && (
              <section className="rc-review">
                <div className="rc-plan__top">
                  <h3 className="rc-plan__h"><Ic.book />{t('reconstruct.reviewTitle')}</h3>
                  {rvCount("review") > 1 && <button type="button" className="rc-rv__btn rc-rv__btn--ok" onClick={acceptAll}><Ic.check />{t('reconstruct.acceptAll')}</button>}
                </div>
                {fatal && <div className="rc-rv__msg rc-rv__msg--err">{t('reconstruct.stopped', { error: fatal })}</div>}
                {Object.entries(results).map(([sid, r]) => (
                  <article className={`rc-rv rc-rv--${r.st}`} key={sid}>
                    <div className="rc-rv__top">
                      <span className="rc-rv__title">{r.title}</span>
                      <span className={`rc-rv__st rc-rv__st--${r.st}`}>{r.st === "running" && <span className="rc-spin" />}{t('reconstruct.status.' + r.st)}</span>
                    </div>
                    {r.st === "pinned" && <div className="rc-rv__msg">{t('reconstruct.pinnedWarn')}</div>}
                    {r.st === "error" && <div className="rc-rv__msg rc-rv__msg--err">{r.error}</div>}
                    {(r.st === "review" || r.st === "applied") && <DiffView before={r.before} after={r.after} />}
                    {r.st === "review" && (
                      <div className="rc-rv__acts">
                        <button type="button" className="rc-rv__btn rc-rv__btn--ok" onClick={() => accept(sid)}><Ic.check />{t('reconstruct.accept')}</button>
                        <button type="button" className="rc-rv__btn" onClick={() => putResult(sid, { st: "rejected" })}><Ic.x />{t('reconstruct.reject')}</button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            <div className="rc__foot">
              <span className="rc__note">
                {isReal ? t('reconstruct.realNote')
                  : phase === "done" ? t('reconstruct.demoNote')
                  : phase === "running" ? t('reconstruct.runningNote')
                  : t('reconstruct.previewNote')}
              </span>
              {phase === "done" ? (
                <button className="rc__run rc__run--done" type="button" onClick={onClose}><Ic.check />{t('reconstruct.done')}</button>
              ) : (
                <button className={`rc__run ${steps.length && phase === "plan" ? "rc__run--go" : ""}`} type="button"
                  onClick={run} disabled={!steps.length || phase === "running"}>
                  {phase === "running" ? <><span className="rc-spin rc-spin--lg" />{t('reconstruct.running')}</> : <>{t('reconstruct.run')}</>}
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
