import {
  BarChart3,
  Database,
  Download,
  FileArchive,
  Folder,
  Languages,
  House,
  KeyRound,
  Library,
  Mail,
  PenLine,
  Search,
  Settings,
  Workflow,
} from "lucide-react";

export type FolioPageId =
  | "workbench"
  | "library"
  | "discover"
  | "governance"
  | "dictionary"
  | "tasks"
  | "export"
  | "files"
  | "settings";

export type SettingsSection = "connection" | "translation" | "privacy" | "export" | "data" | "storage" | "notifications";

export type PageDefinition = {
  id: FolioPageId;
  label: string;
  title: string;
  description: string;
  icon: typeof Settings;
};

export const FOLIO_PAGES: PageDefinition[] = [
  { id: "workbench", label: "首页", title: "首页", description: "继续阅读，查看作品更新和媒体库动态。", icon: House },
  { id: "library", label: "我的库", title: "我的库", description: "浏览、筛选和管理已收藏的漫画。", icon: Library },
  { id: "discover", label: "发现", title: "发现", description: "搜索漫画，在线阅读或加入我的库。", icon: Search },
  { id: "governance", label: "整理", title: "作品整理", description: "补全作品信息，整理标签与文件。", icon: PenLine },
  { id: "dictionary", label: "词典", title: "词典", description: "管理标签翻译与别名。", icon: Languages },
  { id: "tasks", label: "队列", title: "队列", description: "查看任务进度与日志。", icon: Workflow },
  { id: "files", label: "文件", title: "文件", description: "管理媒体库、检查文件并归并本地导入。", icon: FileArchive },
  { id: "settings", label: "设置", title: "设置", description: "集中管理连接、翻译、阅读、导出与本地存储。", icon: Settings },
];

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; description: string; icon: typeof Settings }[] = [
  { id: "connection", label: "连接", description: "远端 API 与运行环境", icon: Database },
  { id: "translation", label: "翻译", description: "服务商、语言与批量建议", icon: Languages },
  { id: "privacy", label: "访问与阅读", description: "密码、封面与阅读方式", icon: KeyRound },
  { id: "export", label: "导出", description: "CBZ 打包默认值", icon: Download },
  { id: "data", label: "统计", description: "阅读记录与作品统计", icon: BarChart3 },
  { id: "storage", label: "存储", description: "阅读缓存、磁盘占用与数据目录", icon: Folder },
  { id: "notifications", label: "邮件通知", description: "邮件发送配置", icon: Mail },
];
