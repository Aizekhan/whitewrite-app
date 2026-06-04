import { useNavigate } from 'react-router-dom';
import '../styles/landing.css';

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="shell">
      {/* Top Rail */}
      <div className="rail">
        <button className="rail__logo" onClick={() => navigate('/')}>
          <img src="/assets/LogoWhiteTree.png" alt="WhiteWrite" />
        </button>
        <div className="rail__div"></div>
        <div className="rail__brand">
          White<b>Write</b>
        </div>
        <div className="rail__foot">
          <button className="ritem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
            </svg>
            <span className="ritem__lbl">Увійти</span>
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="stage">
        <div className="view is-on">
          <div className="vwrap">
            {/* Hero */}
            <div className="home-hero">
              <div className="vhead__k">Мистичний інструмент для письменників</div>
              <h1 className="vhead__t">Твій всесвіт історій</h1>
              <p className="vhead__s">
                WhiteWrite — це не просто редактор. Це магічний простір, де ваш канон живе,
                історії пишуться самі, а кожна зміна автоматично впливає на весь всесвіт.
              </p>
              <div style={{ marginTop: '24px' }}>
                <button className="btn-hero" onClick={() => navigate('/projects')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  Розпочати подорож
                </button>
              </div>
            </div>

            {/* Features */}
            <div className="vsec-h">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Три стовпи майстерності
            </div>

            <div className="grid grid--narr">
              <div className="ncard">
                <div className="ncard__cover" style={{
                  background: 'url(/assets/pergament.png) center/cover, linear-gradient(135deg, #3a2a1e, #1a1412)'
                }}>
                  <div style={{ fontSize: '48px', position: 'relative', zIndex: 1 }}>📖</div>
                </div>
                <div className="ncard__b">
                  <h3 className="ncard__title">Книга (Narrative)</h3>
                  <p className="ncard__meta">Пергамент, шрифт Philosopher</p>
                  <p className="ncard__desc">
                    Пишіть свою історію на магічних розворотах. AI підказує наступну сцену,
                    спираючись на ваш канон.
                  </p>
                </div>
              </div>

              <div className="ncard">
                <div className="ncard__cover" style={{
                  background: 'url(/assets/world-tree.jpg) center 30%/cover, linear-gradient(135deg, #1a1e28, #0f1218)'
                }}>
                  <div style={{ fontSize: '48px', position: 'relative', zIndex: 1 }}>🌳</div>
                </div>
                <div className="ncard__b">
                  <h3 className="ncard__title">Всесвіт (Canon)</h3>
                  <p className="ncard__meta">Темний, Cinzel/золото</p>
                  <p className="ncard__desc">
                    Керуйте персонажами, локаціями, подіями. Зміна в каноні — система сама
                    реконструює залежні сцени.
                  </p>
                </div>
              </div>

              <div className="ncard">
                <div className="ncard__cover" style={{
                  background: 'linear-gradient(135deg, #28201a, #14120f)'
                }}>
                  <div style={{ fontSize: '48px', position: 'relative', zIndex: 1 }}>🎬</div>
                </div>
                <div className="ncard__b">
                  <h3 className="ncard__title">Режисер (Director)</h3>
                  <p className="ncard__meta">Темний, розкадровка</p>
                  <p className="ncard__desc">
                    Візуалізуйте сцени: кадри, діалоги, генерація зображень. Від сценарію до
                    екрану.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '64px',
              textAlign: 'center',
              color: 'var(--tx-mid)',
              fontSize: '13px'
            }}>
              <p>Canon = джерело правди. Memory = View. Story Navigation, не Generation.</p>
              <p style={{ marginTop: '8px', color: 'var(--tx-low)' }}>
                © 2024 WhiteWrite — мистичний інструмент для письменників
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
