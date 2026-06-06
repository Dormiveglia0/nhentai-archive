import { BookDown, CheckSquare, Database, Files, Languages, LogOut, Search } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  active: string;
  onActive: (value: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

const nav = [
  { id: 'import', label: '导入', icon: Search },
  { id: 'tasks', label: '任务', icon: CheckSquare },
  { id: 'dictionary', label: '词典', icon: Languages },
  { id: 'files', label: '文件', icon: Files }
];

export function Shell({ active, onActive, onLogout, children }: Props) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BookDown size={24} />
          <span>Archive</span>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => onActive(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="storage-note">
            <Database size={16} />
            <span>SQLite / CBZ</span>
          </div>
          <button className="ghost-button" onClick={onLogout} title="退出登录">
            <LogOut size={18} />
            <span>退出</span>
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
