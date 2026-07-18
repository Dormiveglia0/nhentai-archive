import {
  BarChart3,
  Database,
  Download,
  FileArchive,
  Folder,
  Languages,
  LayoutDashboard,
  KeyRound,
  Library,
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

export type SettingsSection = "connection" | "translation" | "privacy" | "export" | "data" | "storage";

export type PageDefinition = {
  id: FolioPageId;
  label: string;
  title: string;
  description: string;
  icon: typeof Settings;
};

export const FOLIO_PAGES: PageDefinition[] = [
  { id: "workbench", label: "工作台", title: "工作台", description: "馆藏、治理、任务与文件状态的每日入口。", icon: LayoutDashboard },
  { id: "library", label: "我的库", title: "我的库", description: "筛选、阅读与管理所有真实入库的本地作品。", icon: Library },
  { id: "discover", label: "发现", title: "发现 / 导入", description: "从远端源检索、预览并加入真实导入队列。", icon: Search },
  { id: "governance", label: "治理", title: "治理工作台", description: "聚焦需要人工判断的元数据、词典与文件问题。", icon: PenLine },
  { id: "dictionary", label: "词典", title: "词典治理", description: "统一英文术语、中文显示与检索入口。", icon: Languages },
  { id: "tasks", label: "队列", title: "任务中心", description: "追踪导入、扫描、治理与导出的处理过程。", icon: Workflow },
  { id: "export", label: "导出", title: "导出中心", description: "检查配方并生成带标准元数据的 CBZ。", icon: Download },
  { id: "files", label: "文件", title: "文件管理", description: "核对源文件、索引状态、体积与可回收空间。", icon: FileArchive },
  { id: "settings", label: "设置", title: "设置", description: "集中管理连接、翻译、阅读、导出与本地存储。", icon: Settings },
];

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; description: string; icon: typeof Settings }[] = [
  { id: "connection", label: "连接", description: "远端 API 与运行环境", icon: Database },
  { id: "translation", label: "翻译", description: "服务商、语言与批量建议", icon: Languages },
  { id: "privacy", label: "访问与阅读", description: "密码、封面与阅读方式", icon: KeyRound },
  { id: "export", label: "导出", description: "CBZ 打包默认值", icon: Download },
  { id: "data", label: "数据", description: "馆藏摘要与语言分布", icon: BarChart3 },
  { id: "storage", label: "存储", description: "目录、源文件与空间", icon: Folder },
];
