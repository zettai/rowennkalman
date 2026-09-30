"use client";

import { useState } from "react";
import type { Content, PageKey } from "@/lib/content/schema";
import { getPageDef } from "@/lib/content/fields";
import { EditorShell } from "./EditorShell";
import { SectionFields } from "./SectionFields";
import { usePageEditor, type ImageUrls } from "./usePageEditor";

type Props = { page: Exclude<PageKey, "portfolio">; content: Content; imageUrls: ImageUrls };

/** Generic editor for a registry page: every section and field, one Save. */
export function PageEditor({ page, content, imageUrls }: Props) {
  const def = getPageDef(page)!;
  const ed = usePageEditor(page, content, imageUrls);
  const [uploads, setUploads] = useState(0);
  const onBusyChange = (busy: boolean) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)));

  return (
    <EditorShell
      title={def.title}
      description={def.description}
      publicPath={def.publicPath}
      dirty={ed.dirty}
      busy={uploads > 0}
      status={ed.status}
      onSave={ed.save}
    >
      {def.sections.map((section) => (
        <SectionFields
          key={section.id}
          page={page}
          section={section}
          draft={ed.draft}
          onDraft={(fn) => ed.update(fn)}
          urls={ed.urls}
          onUploaded={(r) => ed.addImageUrl(r.image.key, r.url)}
          onRelease={ed.releaseImage}
          onBusyChange={onBusyChange}
          artworks={ed.saved.portfolio.artworks}
        />
      ))}
    </EditorShell>
  );
}
