import { useEffect, useRef } from "react";

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
  const heading = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = heading.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => node.classList.toggle("is-offscreen", !entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={heading} className="folio-page-head">
      <div className="folio-page-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <ModuleScene page={page.id} />
    </header>
  );
}
