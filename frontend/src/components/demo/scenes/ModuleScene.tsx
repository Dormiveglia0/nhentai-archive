import type { ComponentType } from "react";

import type { FolioPageId } from "../config";
import { DictionaryScene } from "./DictionaryScene";
import { DiscoverScene } from "./DiscoverScene";
import { ExportScene } from "./ExportScene";
import { FilesScene } from "./FilesScene";
import { GovernanceScene } from "./GovernanceScene";
import { LibraryScene } from "./LibraryScene";
import { SettingsScene } from "./SettingsScene";
import { TasksScene } from "./TasksScene";
import { WorkbenchScene } from "./WorkbenchScene";

const SCENES: Record<FolioPageId, ComponentType> = {
  workbench: WorkbenchScene,
  library: LibraryScene,
  discover: DiscoverScene,
  governance: GovernanceScene,
  dictionary: DictionaryScene,
  tasks: TasksScene,
  export: ExportScene,
  files: FilesScene,
  settings: SettingsScene,
};

export function ModuleScene({ page }: { page: FolioPageId }) {
  const Scene = SCENES[page];
  return (
    <div className={`folio-demo-scene folio-demo-scene-${page}`} aria-hidden="true">
      <svg viewBox="0 0 540 230"><Scene /></svg>
    </div>
  );
}
