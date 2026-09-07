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

const SCENES: Record<Exclude<FolioPageId, "workbench">, ComponentType> = {
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
  if (page === "workbench") return null;
  const Scene = SCENES[page];
  return (
    <div className={`folio-scene folio-scene-${page}`} aria-hidden="true">
      <svg viewBox="0 0 540 230" preserveAspectRatio="xMaxYMid meet"><Scene /></svg>
    </div>
  );
}
