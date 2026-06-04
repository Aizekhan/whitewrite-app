import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createProject } from '@/firebase';
import { ProjectCanon } from '@shared/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const GENRES = [
  'Фентезі',
  'Наукова фантастика',
  'Детектив',
  'Трилер',
  'Романтика',
  'Драма',
  'Пригоди',
  'Жахи',
];

const SCOPES = [
  { value: 'short', label: 'Оповідання (до 10к слів)' },
  { value: 'novella', label: 'Повість (10-50к слів)' },
  { value: 'novel', label: 'Роман (50к+ слів)' },
  { value: 'series', label: 'Серія / Сезон' },
];

function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [ending, setEnding] = useState('');
  const [scope, setScope] = useState('novel');
  const [genres, setGenres] = useState<string[]>([]);
  const [dialogueDensity, setDialogueDensity] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    if (genres.includes(genre)) {
      setGenres(genres.filter((g) => g !== genre));
    } else {
      setGenres([...genres, genre]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Initialize empty canon
      const canon: ProjectCanon = {
        characters: [],
        locations: [],
        events: [],
        factions: [],
        artifacts: [],
        world: {
          facts: [],
          rules: [],
        },
      };

      await createProject(projectId, user.uid, {
        title,
        ending,
        scope,
        genres,
        dialogueDensity,
        canon,
        canonAware: true, // New projects are canon-aware from day 1
      });

      // Reset form
      setTitle('');
      setEnding('');
      setScope('novel');
      setGenres([]);
      setDialogueDensity(50);

      onCreated();
    } catch (err: any) {
      setError(err.message || 'Помилка створення проєкту');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="proj-edit is-on">
      <div className="pe-scrim" onClick={onClose}></div>
      <div className="pe-card" role="dialog" aria-modal="true">
        <button className="pe-x" onClick={onClose} aria-label="Закрити">
          ✕
        </button>
        <div className="pe-kicker">Новий проєкт</div>
        <h2 className="pe-title-h">Створити всесвіт</h2>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <label className="pe-field">
            <span className="pe-lbl">Назва проєкту</span>
            <input
              className="pe-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Хроніки забутого світу"
              required
            />
          </label>

          {/* Ending / Premise */}
          <label className="pe-field">
            <span className="pe-lbl">Кінцева мета (ending)</span>
            <textarea
              className="pe-area"
              value={ending}
              onChange={(e) => setEnding(e.target.value)}
              placeholder="Опишіть, до чого йде історія (1-2 речення)"
              rows={3}
            />
          </label>

          {/* Scope */}
          <label className="pe-field">
            <span className="pe-lbl">Обсяг</span>
            <select className="pe-sel" value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* Genres */}
          <div className="pe-field">
            <span className="pe-lbl">Жанри</span>
            <div className="pe-genres">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  className={`pe-chip ${genres.includes(genre) ? 'is-on' : ''}`}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Dialogue Density */}
          <label className="pe-field">
            <span className="pe-lbl">
              Щільність діалогу: {dialogueDensity}%
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={dialogueDensity}
              onChange={(e) => setDialogueDensity(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--gold-lit)',
              }}
            />
            <span className="pe-hint">
              {dialogueDensity < 30
                ? '📖 Більше розповіді (описи, наратив)'
                : dialogueDensity > 70
                ? '💬 Більше діалогів (розмови персонажів)'
                : '⚖️ Збалансовано'}
            </span>
          </label>

          {/* Error */}
          {error && <div className="auth-error">{error}</div>}

          {/* Buttons */}
          <div className="pe-foot">
            <button type="button" className="pe-btn" onClick={onClose}>
              Скасувати
            </button>
            <button type="submit" className="pe-btn pe-btn--save" disabled={loading}>
              {loading ? '⏳ Створення...' : '✦ Створити проєкт'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectModal;
