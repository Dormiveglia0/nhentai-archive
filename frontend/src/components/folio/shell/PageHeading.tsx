import type { PageDefinition } from "../config";
import { ModuleScene } from "../scenes/ModuleScene";

export function PageHeading({
  page,
  title = page.title,
  description = page.description,
}: {
  page: PageDefinition;
  title?: string;
  description?: string;
}) {
  return (
    <header className="folio-page-head">
      <div className="folio-page-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <ModuleScene page={page.id} />
    </header>
  );
}
