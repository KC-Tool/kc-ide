import type { SkillListItem } from '../../shared/skills-types';

export interface SlashMenuItem {
  id: string;
  label: string;
  description: string;
  insertText: string;
  kind: 'command' | 'skill' | 'team';
}

interface Props {
  items: SlashMenuItem[];
  selectedIndex: number;
  onSelect: (item: SlashMenuItem) => void;
  visible: boolean;
  kindLabels?: { cmd: string; skill: string; team?: string };
}

export function buildSlashMenuItems(
  skills: SkillListItem[],
  filter: string,
  labels?: { skillsDesc: string; helpDesc: string; skillUsePrefix: string },
): SlashMenuItem[] {
  const q = filter.toLowerCase().replace(/^\//, '');
  const skillsDesc = labels?.skillsDesc ?? 'List skills';
  const helpDesc = labels?.helpDesc ?? 'Help';
  const skillUsePrefix = labels?.skillUsePrefix ?? 'Skill:';

  const base: SlashMenuItem[] = [
    { id: 'skills', label: '/skills', description: skillsDesc, insertText: '/skills ', kind: 'command' },
    { id: 'help', label: '/help', description: helpDesc, insertText: '/help ', kind: 'command' },
  ];

  for (const s of skills) {
    base.push({
      id: s.id,
      label: `/${s.id}`,
      description: s.description,
      insertText: `/${s.id} `,
      kind: 'skill',
    });
    base.push({
      id: `skill-${s.id}`,
      label: `/skill ${s.id}`,
      description: `${skillUsePrefix} ${s.name}`,
      insertText: `/skill ${s.id} `,
      kind: 'skill',
    });
  }

  if (!q) return base.slice(0, 12);

  return base.filter(
    item =>
      item.label.toLowerCase().includes(q)
      || item.id.toLowerCase().includes(q)
      || item.description.toLowerCase().includes(q),
  ).slice(0, 12);
}

export default function SlashCommandMenu({ items, selectedIndex, onSelect, visible, kindLabels }: Props) {
  if (!visible || items.length === 0) return null;

  return (
    <div className="slash-menu" role="listbox">
      {items.map((item, i) => (
        <button
          key={item.id + item.label}
          type="button"
          role="option"
          aria-selected={i === selectedIndex}
          className={`slash-menu-item ${i === selectedIndex ? 'selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          <span className={`slash-menu-kind slash-menu-kind-${item.kind}`}>
            {item.kind === 'skill'
              ? (kindLabels?.skill ?? 'Skill')
              : item.kind === 'team'
                ? (kindLabels?.team ?? 'Team')
                : (kindLabels?.cmd ?? 'Cmd')}
          </span>
          <span className="slash-menu-label">{item.label}</span>
          <span className="slash-menu-desc">{item.description}</span>
        </button>
      ))}
    </div>
  );
}
