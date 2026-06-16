// Pricing Modal — показує всі тіри при спробі upgrade або виклику з меню
const { useState: usePState } = React;

function PricingModal({ isOpen, onClose, currentPlan }) {
  const [selectedPlan, setSelectedPlan] = usePState(null);

  if (!isOpen) return null;

  // Get plan configs from token-budget.js
  const plans = window.__PLAN_BUDGETS || {};
  const user = window.__wwUser || {};

  const tiers = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: '',
      tagline: 'Спробуйте магію WhiteWrite',
      features: [
        '10 Gemini сцен/міс',
        '1 проєкт',
        'Canon-aware generation',
        'Read-only Universe'
      ],
      limitations: [
        'Без Claude',
        'Без зображень',
        'Без експорту'
      ],
      cta: 'Поточний план',
      disabled: currentPlan === 'free',
      highlight: false
    },
    {
      id: 'storyteller',
      name: 'Storyteller',
      price: 12,
      period: '/міс',
      tagline: 'Для письменників-hobbyістів',
      features: [
        '120 Gemini сцен/міс',
        '5 проєктів',
        '✨ Експорт DOCX/PDF',
        'Version history (30 днів)'
      ],
      limitations: [
        'Без Claude',
        'Без зображень (text-only tier)'
      ],
      cta: currentPlan === 'storyteller' ? 'Поточний план' : 'Підписатись',
      disabled: currentPlan === 'storyteller',
      highlight: false
    },
    {
      id: 'novelist',
      name: 'Novelist',
      price: 29,
      period: '/міс',
      badge: '⭐ POPULAR',
      tagline: 'Для серйозних авторів',
      features: [
        '32K tokens (гнучко)',
        'Claude Sonnet доступ',
        '100 image credits/міс',
        '3 LoRA slots per project',
        '🔥 Universe Reconstruction',
        'Hidden Canon (twists)',
        '∞ проєктів',
        'Експорт DOCX/PDF/EPUB'
      ],
      limitations: [],
      cta: currentPlan === 'novelist' ? 'Поточний план' : 'Вибрати Novelist',
      disabled: currentPlan === 'novelist',
      highlight: true
    },
    {
      id: 'worldbuilder',
      name: 'Worldbuilder',
      price: 69,
      period: '/міс',
      tagline: 'Для студій та професіоналів',
      features: [
        '180K tokens',
        '500 image credits/міс',
        '10 LoRA slots per project',
        '🎬 Повний препродакшн візуал',
        'API access',
        'Priority queue',
        'Agent Mode (AI auto-reconstruction)',
        'Усе з Novelist'
      ],
      limitations: [],
      cta: currentPlan === 'worldbuilder' ? 'Поточний план' : 'Підписатись',
      disabled: currentPlan === 'worldbuilder',
      highlight: false
    }
  ];

  function handleSelectPlan(planId) {
    if (planId === 'free' || planId === currentPlan) return;

    // TODO: Phase 8 — Stripe Checkout
    // For now, just alert
    alert(`Stripe integration: Phase 8\n\nВи обрали план: ${planId}\n\nПоки що плани змінюються вручну в Firestore Console:\nusers/{uid}.plan = "${planId}"`);
    setSelectedPlan(planId);
  }

  return (
    <div className="pricing-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pricing-close" onClick={onClose} aria-label="Закрити">×</button>

        <div className="pricing-header">
          <h2 className="pricing-title">Оберіть ваш план</h2>
          <p className="pricing-subtitle">Гнучке ціноутворення для кожного етапу вашої творчої подорожі</p>
        </div>

        <div className="pricing-tiers">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`pricing-tier ${tier.highlight ? 'pricing-tier--highlight' : ''} ${tier.disabled ? 'pricing-tier--disabled' : ''}`}
            >
              {tier.badge && <div className="pricing-badge">{tier.badge}</div>}

              <div className="pricing-tier-header">
                <h3 className="pricing-tier-name">{tier.name}</h3>
                <div className="pricing-tier-price">
                  <span className="pricing-tier-price-amount">${tier.price}</span>
                  <span className="pricing-tier-price-period">{tier.period}</span>
                </div>
                <p className="pricing-tier-tagline">{tier.tagline}</p>
              </div>

              <ul className="pricing-features">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="pricing-feature">
                    <span className="pricing-feature-icon">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
                {tier.limitations.map((limitation, idx) => (
                  <li key={`lim-${idx}`} className="pricing-feature pricing-feature--limitation">
                    <span className="pricing-feature-icon">✗</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`pricing-cta ${tier.disabled ? 'pricing-cta--disabled' : ''}`}
                disabled={tier.disabled}
                onClick={() => handleSelectPlan(tier.id)}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="pricing-footer">
          <p className="pricing-footer-note">
            💡 <strong>Token System:</strong> Novelist і Worldbuilder використовують гнучку систему токенів — витрачайте на Gemini, Claude або зображення на ваш вибір.
          </p>
          <p className="pricing-footer-note">
            🔐 Усі плани включають шифрування даних, version history та безлімітне читання.
          </p>
        </div>
      </div>
    </div>
  );
}

window.PricingModal = PricingModal;
