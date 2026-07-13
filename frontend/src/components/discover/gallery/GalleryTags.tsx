import { ArrowUpRight, Tags } from "lucide-react";
import { m } from "motion/react";

import type { GalleryDetail } from "../../../lib/api";
import { Stagger, StaggerItem } from "../../../lib/motion";
import { navigate } from "../../../lib/navigation";
import { defaultDisplayTag } from "../TagScroller";
import { TAG_GROUPS } from "./galleryDetailModel";
import "./GalleryTags.css";

export function GalleryTags({ detail }: { detail: GalleryDetail }) {
  const groups = TAG_GROUPS.map((group) => ({
    ...group,
    tags: detail.tags.filter((tag) => group.types.includes(tag.type)),
  })).filter((group) => group.tags.length > 0);

  if (!groups.length) return null;

  return (
    <section className="folio-gallery-tags">
      <header className="folio-gallery-section-head">
        <div><Tags size={18} /><span><h2>标签索引</h2><p>选择任意真实标签，返回发现页继续检索。</p></span></div>
        <small>{detail.tags.length} 个标签</small>
      </header>
      <Stagger className="folio-gallery-tag-groups">
        {groups.map((group) => (
          <StaggerItem key={group.key} className="folio-gallery-tag-group">
            <h3>{group.label}</h3>
            <div>
              {group.tags.map((tag) => (
                <m.button
                  layout
                  key={tag.id}
                  type="button"
                  onClick={() => navigate({ name: "discover", tag })}
                  whileTap={{ scale: 0.97 }}
                >
                  <span>{defaultDisplayTag(tag)}</span>
                  <ArrowUpRight size={12} />
                </m.button>
              ))}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
