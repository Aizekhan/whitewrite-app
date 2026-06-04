import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getUserProjects, deleteProject } from '@/firebase';
import { Project } from '@shared/types';
import CreateProjectModal from '@/components/CreateProjectModal';
import '../styles/projects.css';

function Projects() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Load projects
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userProjects = await getUserProjects(user.uid);
      setProjects(userProjects as Project[]);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (projectId: string) => {
    setDeletingId(projectId);
    // Auto-delete after 3 seconds if not cancelled
    setTimeout(() => {
      if (deletingId === projectId) {
        handleDeleteConfirm(projectId);
      }
    }, 3000);
  };

  const handleDeleteCancel = () => {
    setDeletingId(null);
  };

  const handleDeleteConfirm = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleProjectCreated = () => {
    loadProjects();
    setCreateModalOpen(false);
  };

  if (authLoading || loading) {
    return (
      <div className="shell">
        <div className="loader is-on">
          <div className="loader__mark"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      {/* Top Rail */}
      <div className="rail">
        <button className="rail__back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button className="rail__logo" onClick={() => navigate('/')}>
          <img src="/assets/LogoWhiteTree.png" alt="WhiteWrite" />
        </button>
        <div className="rail__div"></div>
        <div className="rail__brand">
          White<b>Write</b>
        </div>
        <div className="rail__foot">
          <button className="ritem" onClick={() => navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 11 12 4l8 7M6 10v9h12v-9" />
            </svg>
            <span className="ritem__lbl">Додому</span>
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="stage">
        <div className="view is-on">
          <div className="vwrap">
            <div className="vhead__k">Мої проєкти</div>
            <h1 className="vhead__t">Всесвіти історій</h1>
            <p className="vhead__s">
              Кожен проєкт — це окремий канон, де ваші персонажі живуть, події розгортаються, а
              історії пишуться самі.
            </p>

            {/* Projects Grid */}
            <div className="grid grid--narr" style={{ marginTop: '32px' }}>
              {/* Create New Card */}
              <div className="ncard ncard--new" onClick={() => setCreateModalOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '15px' }}>
                  Створити проєкт
                </div>
              </div>

              {/* Project Cards */}
              {projects.map((project) => (
                <div key={project.id} className="ncard">
                  {deletingId === project.id && (
                    <div className="ncard__delbar">
                      <div
                        className="delbar__fill"
                        style={{ animation: 'delbarFill 3s linear forwards' }}
                      ></div>
                      <div className="delbar__txt">
                        Видалення...{' '}
                        <b onClick={handleDeleteCancel}>Скасувати</b>
                      </div>
                    </div>
                  )}

                  <button
                    className="ncard__edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Open edit modal
                      console.log('Edit project:', project.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>

                  <button
                    className="ncard__del"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(project.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                    </svg>
                  </button>

                  <div
                    className="ncard__cover"
                    style={{
                      backgroundImage: project.cover
                        ? `url(${project.cover})`
                        : 'linear-gradient(135deg, #2a1c16, #10131a)',
                    }}
                  >
                    {!project.cover && (
                      <div style={{ fontSize: '48px', position: 'relative', zIndex: 1 }}>📚</div>
                    )}
                  </div>

                  <div className="ncard__b">
                    <h3 className="ncard__title">{project.title}</h3>
                    <p className="ncard__meta">
                      {project.genres?.join(' · ') || 'Без жанру'} · {project.scope || 'Short'}
                    </p>
                    <p className="ncard__desc">
                      {project.ending || 'Історія тільки починається...'}
                    </p>
                    <button
                      className="ncard__open"
                      onClick={() => navigate(`/book/${project.id}`)}
                    >
                      Відкрити
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {projects.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx-mid)' }}>
                <p style={{ fontSize: '15px', fontStyle: 'italic' }}>
                  У вас ще немає проєктів. Створіть свій перший всесвіт!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}

export default Projects;
