import { BookOpen, Download, EyeOff, Library, Search, Settings, Upload, Workflow } from "lucide-react";
import { ReactNode } from "react";

import { navigate } from "../../lib/navigation";
import { TaskDock } from "./TaskDock";

type Props = {
  activePage: string;
  privacyMode: boolean;
  blurCovers: boolean;
  onPrivacyModeChange: (value: boolean) => void;
  onBlurCoversChange: (value: boolean) => void;
  children: ReactNode;
};

const NAV = [
  { id: "discover", label: "发现", icon: Search },
  { id: "library", label: "我的库", icon: Library },
  { id: "tasks", label: "队列", icon: Workflow },
  { id: "settings", label: "设置", icon: Settings }
];

export function ArchiveShell({
  activePage,
  privacyMode,
  blurCovers,
  onPrivacyModeChange,
  onBlurCoversChange,
  children
}: Props) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate({ name: "discover" })}>
          <span className="brand-mark">NH</span>
          <span>
            <strong>ARCHIVE</strong>
            <small>アーカイブ</small>
          </span>
          <i>私藏</i>
        </button>

        <label className="global-search">
          <Search size={18} />
          <input placeholder="搜索 书名 / 圈子 / 作者 / 标签..." disabled />
          <kbd>/</kbd>
        </label>

        <div className="top-actions">
          <button className="icon-label" type="button" onClick={() => navigate({ name: "tasks" })}>
            <Workflow size={18} />
            队列
          </button>
          <label className="toggle">
            <EyeOff size={17} />
            隐私模式
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={(event) => onPrivacyModeChange(event.target.checked)}
            />
            <span />
          </label>
          <label className="toggle">
            <BookOpen size={17} />
            封面模糊
            <input
              type="checkbox"
              checked={blurCovers}
              onChange={(event) => onBlurCoversChange(event.target.checked)}
            />
            <span />
          </label>
          <button className="icon-only" type="button" title="导入入口在发现页">
            <Upload size={18} />
          </button>
          <button className="icon-only" type="button" title="导出中心将在后续阶段接入">
            <Download size={18} />
          </button>
          <div className="user-chip">NH_Collector</div>
        </div>
      </header>

      <nav className="navline">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activePage === item.id ? "active" : ""}
              type="button"
              onClick={() => navigate({ name: item.id as "discover" | "library" | "tasks" | "settings" })}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <main>{children}</main>
      <TaskDock />
    </div>
  );
}
