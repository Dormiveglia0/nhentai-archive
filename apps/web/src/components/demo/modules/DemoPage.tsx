import type { FolioPageId, SettingsSection } from "../../folio/config";
import { DictionaryDemo } from "./DictionaryDemo";
import { DiscoverDemo } from "./DiscoverDemo";
import { ExportDemo } from "./ExportDemo";
import { FilesDemo } from "./FilesDemo";
import { GovernanceDemo } from "./GovernanceDemo";
import { LibraryDemo } from "./LibraryDemo";
import { SettingsDemo } from "./SettingsDemo";
import { TasksDemo } from "./TasksDemo";
import { WorkbenchDemo } from "./WorkbenchDemo";

export function DemoPage({
  page,
  settingsSection,
  onSettingsSection,
  settingsRevision,
  onNavigate,
  announce,
}: {
  page: FolioPageId;
  settingsSection: SettingsSection;
  onSettingsSection: (section: SettingsSection) => void;
  settingsRevision: number;
  onNavigate: (page: FolioPageId) => void;
  announce: (message: string) => void;
}) {
  if (page === "workbench") return <WorkbenchDemo onNavigate={onNavigate} />;
  if (page === "library") return <LibraryDemo onNavigate={onNavigate} />;
  if (page === "discover") return <DiscoverDemo announce={announce} />;
  if (page === "governance") return <GovernanceDemo />;
  if (page === "dictionary") return <DictionaryDemo announce={announce} />;
  if (page === "tasks") return <TasksDemo />;
  if (page === "export") return <ExportDemo />;
  if (page === "files") return <FilesDemo />;
  return <SettingsDemo key={settingsRevision} section={settingsSection} onSection={onSettingsSection} announce={announce} />;
}
