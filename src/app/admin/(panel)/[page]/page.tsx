import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPageDef } from "@/lib/content/fields";
import { getStore } from "@/lib/store";
import { imageUrlsFor } from "@/lib/admin/handlers";
import { PageEditor } from "../../_components/PageEditor";
import { PortfolioEditor } from "../../_components/PortfolioEditor";

type Params = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const def = getPageDef((await params).page);
  return { title: def ? `${def.title} · Site editor` : "Site editor" };
}

export default async function EditPage({ params }: Params) {
  const def = getPageDef((await params).page);
  if (!def) notFound();
  const store = getStore();
  const content = await store.getContent();
  const imageUrls = imageUrlsFor(store, content);
  if (def.key === "portfolio") return <PortfolioEditor content={content} imageUrls={imageUrls} />;
  return <PageEditor key={content.updatedAt} page={def.key} content={content} imageUrls={imageUrls} />;
}
