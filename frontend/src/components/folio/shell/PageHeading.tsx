import type { PageDefinition } from "../config";
import { ModuleScene } from "../scenes/ModuleScene";

export function PageHeading({ page }: { page: PageDefinition }) {
  return (
    <header className="folio-page-head">
      <div className="folio-page-copy">
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </div>
      <ModuleScene page={page.id} />
    </header>
  );
}
