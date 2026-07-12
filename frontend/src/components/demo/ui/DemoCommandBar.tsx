import { Folder, PackageOpen, Plus, RefreshCw, RotateCcw, Save, Search, Settings } from "lucide-react";

import type { FolioPageId } from "../config";

export function DemoCommandBar({
  page,
  onNavigate,
  onResetSettings,
  announce,
}: {
  page: FolioPageId;
  onNavigate: (page: FolioPageId) => void;
  onResetSettings: () => void;
  announce: (message: string) => void;
}) {
  const primary = {
    workbench: { label: "刷新视图", icon: RefreshCw, action: () => announce("演示环境没有可刷新的真实数据。") },
    library: { label: "发现作品", icon: Search, action: () => onNavigate("discover") },
    discover: { label: "打开随机作品", icon: Search, action: () => announce("演示环境未连接远端源。") },
    governance: { label: "刷新队列", icon: RefreshCw, action: () => announce("演示环境没有真实治理队列。") },
    dictionary: { label: "新建本地词条", icon: Plus, action: () => announce("可在术语编辑器中填写新词条；演示页不会写入。") },
    tasks: { label: "刷新任务", icon: RefreshCw, action: () => announce("演示环境没有真实任务。") },
    export: { label: "生成 CBZ", icon: PackageOpen, action: () => announce("请先从真实馆藏选择作品。") },
    files: { label: "扫描目录", icon: Folder, action: () => announce("公开演示不会读取本机目录。") },
    settings: { label: "保存设置", icon: Save, action: () => announce("演示设置已保留在当前页面，未写入服务器或本地文件。") },
  }[page];
  const PrimaryIcon = primary.icon;

  return (
    <footer className="folio-demo-command-bar">
      <p><span />演示模式 · 未连接真实业务数据</p>
      <div>
        {page === "settings" ? (
          <button className="folio-demo-line-button" type="button" onClick={onResetSettings}><RotateCcw size={15} />重新读取</button>
        ) : (
          <button className="folio-demo-line-button" type="button" onClick={() => onNavigate("settings")}><Settings size={15} />设置</button>
        )}
        <button className="folio-demo-primary-button" type="button" onClick={primary.action}>
          <PrimaryIcon size={15} />
          {primary.label}
        </button>
      </div>
    </footer>
  );
}


