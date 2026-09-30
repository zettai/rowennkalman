import { z } from "zod";

/**
 * The content contract. This schema is the single source of truth for
 * content.json; the admin, the stores and the public pages all use it.
 */

/** Bucket keys the app writes: "art/" + a filename (letters, digits, dash, underscore, dot). */
export const IMAGE_KEY_PATTERN = /^art\/[A-Za-z0-9][A-Za-z0-9._-]*\.jpg$/;

export const ImageRefSchema = z.object({
  key: z.string().regex(IMAGE_KEY_PATTERN, "Image key must look like art/<name>.jpg"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().max(500),
  /** A tiny blurred JPEG (data URL, ~20 px) shown while the real picture loads. Optional: older pictures have none. */
  blur: z
    .string()
    .max(2000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Blur preview must be a small JPEG data URL")
    .optional(),
});

export const ArtworkSchema = z.object({
  id: z.string().uuid(),
  image: ImageRefSchema,
  title: z.string().max(200),
  medium: z.string().max(200),
  size: z.string().max(100),
  year: z.string().max(50),
  description: z.string().max(5000),
});

const ResearchDocumentSchema = z.object({
  id: z.string().min(1).max(100),
  labelEn: z.string().max(300),
  labelEs: z.string().max(300),
  href: z.string().max(2000),
});

export const ContentSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime({ offset: true }),
  site: z.object({
    name: z.string().max(200),
    metaTitle: z.string().max(200),
    metaDescription: z.string().max(500),
    nav: z.object({
      home: z.string().max(50),
      about: z.string().max(50),
      portfolio: z.string().max(50),
      research: z.string().max(50),
      contact: z.string().max(50),
    }),
    footer: z.object({
      followLabel: z.string().max(100),
      followUrl: z.string().max(2000),
    }),
  }),
  home: z.object({
    heroTitle: z.string().max(200),
    heroSubtitle: z.string().max(500),
    heroImage: ImageRefSchema.nullable(),
    /** Up to three artwork ids, shown under the hero in this order. */
    featured: z.array(z.string().uuid()).max(3),
    portfolioLinkLabel: z.string().max(100),
  }),
  about: z.object({
    title: z.string().max(200),
    body: z.string().max(20000),
    images: z.array(ImageRefSchema).max(20),
  }),
  portfolio: z.object({
    title: z.string().max(200),
    intro: z.string().max(5000),
    artworks: z.array(ArtworkSchema).max(500),
  }),
  research: z.object({
    title: z.string().max(200),
    introEn: z.string().max(20000),
    introEs: z.string().max(20000),
    image: ImageRefSchema.nullable(),
    documents: z.array(ResearchDocumentSchema).max(50),
  }),
  contact: z.object({
    title: z.string().max(200),
    intro: z.string().max(5000),
    image: ImageRefSchema.nullable(),
    form: z.object({
      nameLabel: z.string().max(100),
      emailLabel: z.string().max(100),
      messageLabel: z.string().max(100),
      submitLabel: z.string().max(100),
      successMessage: z.string().max(500),
      errorMessage: z.string().max(500),
    }),
  }),
});

export type ImageRef = z.infer<typeof ImageRefSchema>;
export type Artwork = z.infer<typeof ArtworkSchema>;
export type ResearchDocument = z.infer<typeof ResearchDocumentSchema>;
export type Content = z.infer<typeof ContentSchema>;

// Zod-free helpers live in helpers.ts so client components can use them without bundling zod.
export { PAGE_KEYS, isPageKey, collectImageKeys, paragraphs, type PageKey } from "./helpers";
