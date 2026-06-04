import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SkillHubRemoteSkill, SkillListItem } from '../../shared/ipc';
import { parseSkillHubSlug, skillHubSkillUrl } from '../../shared/skillhub-types';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  onClose: () => void;
}

const PAGE_SIZE = 12;

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function SkillsStore({ onClose }: Props) {
  const { t } = useI18n();

  const [localSkills, setLocalSkills] = useState<SkillListItem[]>([]);
  const [remoteSkills, setRemoteSkills] = useState<SkillHubRemoteSkill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [installInput, setInstallInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [skillDetailId, setSkillDetailId] = useState<string | null>(null);
  const [skillDetailBody, setSkillDetailBody] = useState<string | null>(null);

  const installedIds = useMemo(
    () => new Set(localSkills.map(s => s.id)),
    [localSkills],
  );

  const loadLocal = useCallback(async () => {
    const list = await window.koder.getSkills();
    setLocalSkills(list);
  }, []);

  const loadRemote = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.koder.searchSkillHub({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        sortBy: 'score',
        order: 'desc',
      });
      setRemoteSkills(result.skills);
      setTotal(result.total);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : String(err),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    void loadLocal();
    return window.koder.onSkillsChanged(() => { void loadLocal(); });
  }, [loadLocal]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const handleInstall = useCallback(async (slug: string) => {
    setInstallingSlug(slug);
    try {
      const result = await window.koder.installSkillFromSkillHub(slug);
      if (result.ok) {
        setToast({ message: t('skills.installOk', { id: result.skillId }), type: 'success' });
        await loadLocal();
      } else {
        setToast({ message: result.error ?? t('skills.installFail'), type: 'error' });
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : t('skills.installFail'),
        type: 'error',
      });
    } finally {
      setInstallingSlug(null);
    }
  }, [loadLocal, t]);

  const handleInstallFromInput = () => {
    const slug = parseSkillHubSlug(installInput);
    if (!slug) {
      setToast({ message: t('skills.invalidUrl'), type: 'error' });
      return;
    }
    void handleInstall(slug);
  };

  const openLocalDetail = useCallback(async (id: string) => {
    setSkillDetailId(id);
    const skill = await window.koder.getSkill(id);
    setSkillDetailBody(skill?.content ?? null);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const builtinSkills = localSkills.filter(s => s.source === 'builtin');
  const userSkills = localSkills.filter(s => s.source === 'user');

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal modal-lg skills-store-modal">
        <div className="modal-header">
          <h2>{t('skills.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <IconX />
          </button>
        </div>

        <div className="skills-store-body modal-body">
          <div className="skills-store-toolbar-row">
            <input
              className="settings-input skills-store-search"
              placeholder={t('skills.search.placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button type="button" className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {t('skills.search.button')}
            </button>
            <a
              className="btn btn-ghost"
              href="https://www.skillhub.cn/skills"
              target="_blank"
              rel="noreferrer"
            >
              {t('skills.openSkillHub')}
            </a>
          </div>

          <div className="skills-store-install-row">
            <input
              className="settings-input"
              placeholder={t('skills.installFromUrl')}
              value={installInput}
              onChange={(e) => setInstallInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInstallFromInput(); }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleInstallFromInput}
              disabled={!!installingSlug}
            >
              {installingSlug ? t('skills.installing') : t('skills.install')}
            </button>
          </div>

          <p className="skills-store-meta">
            {t('skills.remote')} · {t('skills.total', { count: total.toLocaleString() })}
          </p>

          <div className="skills-store-grid">
            {remoteSkills.map((s) => {
              const installed = installedIds.has(s.slug);
              return (
                <div key={s.slug} className="skills-store-card">
                  <div className="skills-store-card-meta">
                    <span className="skills-store-badge">SkillHub</span>
                    <code className="skills-store-id">/{s.slug}</code>
                  </div>
                  <div className="skills-store-card-name">{s.name}</div>
                  <div className="skills-store-card-desc">{s.description}</div>
                  <div className="skills-store-card-stats">
                    {s.downloads > 0 && <span>{s.downloads.toLocaleString()} DL</span>}
                    {s.stars != null && s.stars > 0 && <span>{s.stars.toLocaleString()} ★</span>}
                  </div>
                  <div className="skills-store-card-actions">
                    <a
                      className="btn btn-ghost"
                      href={skillHubSkillUrl(s.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('skills.viewDetail')}
                    </a>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={installed || installingSlug === s.slug}
                      onClick={() => void handleInstall(s.slug)}
                    >
                      {installed
                        ? t('skills.alreadyInstalled')
                        : installingSlug === s.slug
                          ? t('skills.installing')
                          : t('skills.install')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="skills-store-pagination">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                {t('skills.pagePrev')}
              </button>
              <span>{page} / {totalPages}</span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                {t('skills.pageNext')}
              </button>
            </div>
          )}

          <div className="settings-section-title">{t('skills.builtin')}</div>
          <div className="skills-store-grid skills-store-grid-compact">
            {builtinSkills.map(s => (
              <LocalSkillCard
                key={s.id}
                skill={s}
                sourceLabel={t('skills.source.builtin')}
                viewLabel={t('skills.viewDetail')}
                active={skillDetailId === s.id}
                onView={() => void openLocalDetail(s.id)}
              />
            ))}
          </div>

          <div className="settings-section-title">{t('skills.user')}</div>
          {userSkills.length === 0 ? (
            <p className="skills-store-empty">{t('skills.noUser')}</p>
          ) : (
            <div className="skills-store-grid skills-store-grid-compact">
              {userSkills.map(s => (
                <LocalSkillCard
                  key={s.id}
                  skill={s}
                  sourceLabel={t('skills.source.user')}
                  viewLabel={t('skills.viewDetail')}
                  active={skillDetailId === s.id}
                  onView={() => void openLocalDetail(s.id)}
                />
              ))}
            </div>
          )}

          {skillDetailId && skillDetailBody !== null && (
            <div className="skills-store-detail">
              <div className="skills-store-detail-header">
                <code>/{skillDetailId}</code>
                <button type="button" className="btn btn-ghost" onClick={() => setSkillDetailId(null)}>
                  {t('common.close')}
                </button>
              </div>
              <pre className="skills-store-detail-body">{skillDetailBody.slice(0, 12000)}</pre>
            </div>
          )}
        </div>

        <div className="skills-store-footer">
          <button type="button" className="btn btn-ghost" onClick={() => void loadLocal()}>
            {t('skills.reload')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        {toast && (
          <div className={`toast toast-${toast.type} skills-store-toast`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

function LocalSkillCard({
  skill,
  sourceLabel,
  viewLabel,
  active,
  onView,
}: {
  skill: SkillListItem;
  sourceLabel: string;
  viewLabel: string;
  active: boolean;
  onView: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`skills-store-card ${active ? 'active' : ''}`}>
      <div className="skills-store-card-meta">
        <span className="skills-store-badge">{sourceLabel}</span>
        <code className="skills-store-id">/{skill.id}</code>
      </div>
      <div className="skills-store-card-name">{skill.name}</div>
      <div className="skills-store-card-desc">{skill.description}</div>
      <div className="skills-store-card-actions">
        <span className="skills-store-hint">{t('skills.useHint')} <code>/{skill.id}</code></span>
        <button type="button" className="btn btn-ghost" onClick={onView}>{viewLabel}</button>
      </div>
    </div>
  );
}
