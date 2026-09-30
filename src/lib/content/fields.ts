import type { PageKey } from "./schema";

/**
 * Field registry: every editable text in Content, grouped page -> section,
 * each with a label and a one-line hint for a non-technical editor.
 *
 * The admin forms are generated from this list. To add a field: add it to
 * ContentSchema, then add one entry here. tests/fields.test.ts fails if a
 * string in the schema has no entry.
 *
 * Paths are dotted, from the root of Content ("home.heroTitle"). Inside a
 * list, item fields use paths relative to the item ("labelEn").
 */

export type TextField = {
  kind: "text" | "textarea" | "url";
  path: string;
  label: string;
  hint: string;
  /** Soft guidance shown under the field; the schema holds the hard limit. */
  maxLength?: number;
};

/** A single optional image: pick, preview, replace, remove, alt text. */
export type ImageField = { kind: "image"; path: string; label: string; hint: string };

/** An ordered list of images, each with alt text. */
export type ImageListField = { kind: "imageList"; path: string; label: string; hint: string; max: number };

/** Up to `max` paintings chosen from the portfolio, stored as artwork ids in order. */
export type ArtworkPickField = { kind: "artworkPick"; path: string; label: string; hint: string; max: number };

/** An ordered list of small records, each edited with the item fields. */
export type ListField = {
  kind: "list";
  path: string;
  label: string;
  hint: string;
  itemLabel: string;
  addLabel: string;
  fields: TextField[];
};

export type Field = TextField | ImageField | ImageListField | ArtworkPickField | ListField;

export type Section = { id: string; title: string; hint?: string; fields: Field[] };

export type PageDef = {
  key: PageKey;
  title: string;
  description: string;
  /** Public path this page's content appears on, for the "View this page" link. */
  publicPath: string;
  sections: Section[];
};

export const PAGES: PageDef[] = [
  {
    key: "home",
    title: "Home page",
    description: "The first page visitors see: your name, a painting beside it, and a few chosen paintings below.",
    publicPath: "/",
    sections: [
      {
        id: "hero",
        title: "Top of the page",
        fields: [
          {
            kind: "text",
            path: "home.heroTitle",
            label: "Your name (big title)",
            hint: "Shown in big letters at the top of the home page.",
            maxLength: 120,
          },
          {
            kind: "textarea",
            path: "home.heroSubtitle",
            label: "Line under your name",
            hint: "A word or short line shown just below your name, for example: Artist.",
            maxLength: 300,
          },
          {
            kind: "image",
            path: "home.heroImage",
            label: "Painting beside your name",
            hint: "Shown next to your name at the top of the home page, cropped to a tall shape.",
          },
        ],
      },
      {
        id: "chosen",
        title: "Paintings under the top",
        fields: [
          {
            kind: "artworkPick",
            path: "home.featured",
            label: "Chosen paintings",
            hint: "Pick up to three paintings from your portfolio, shown in this order.",
            max: 3,
          },
          {
            kind: "text",
            path: "home.portfolioLinkLabel",
            label: "Link to the portfolio",
            hint: "The words of the link under the chosen paintings.",
          },
        ],
      },
    ],
  },
  {
    key: "about",
    title: "About page",
    description: "Your story, in your words, with a few pictures.",
    publicPath: "/about",
    sections: [
      {
        id: "text",
        title: "Words",
        fields: [
          { kind: "text", path: "about.title", label: "Page title", hint: "The heading at the top of the About page." },
          {
            kind: "textarea",
            path: "about.body",
            label: "Your story",
            hint: "Leave an empty line between paragraphs to start a new one.",
          },
        ],
      },
      {
        id: "pictures",
        title: "Pictures",
        fields: [
          {
            kind: "imageList",
            path: "about.images",
            label: "Pictures on the About page",
            hint: "Photos of you, your studio or your work, shown in this order.",
            max: 20,
          },
        ],
      },
    ],
  },
  {
    key: "portfolio",
    title: "Portfolio",
    description: "Your paintings: add, edit, reorder and remove them.",
    publicPath: "/portfolio",
    sections: [
      {
        id: "intro",
        title: "Words above the paintings",
        fields: [
          {
            kind: "text",
            path: "portfolio.title",
            label: "Page title",
            hint: "Not shown on the page (the paintings speak for themselves); read aloud by screen readers and used by search engines.",
          },
          {
            kind: "textarea",
            path: "portfolio.intro",
            label: "Introduction",
            hint: "A few words shown above your paintings. Can be left empty.",
          },
        ],
      },
    ],
  },
  {
    key: "research",
    title: "Research page",
    description: "Your thesis work, in English and Spanish, with links to documents.",
    publicPath: "/research",
    sections: [
      {
        id: "text",
        title: "Words",
        fields: [
          { kind: "text", path: "research.title", label: "Page title", hint: "The heading at the top of the Research page." },
          {
            kind: "textarea",
            path: "research.introEn",
            label: "Introduction (English)",
            hint: "The English text. Leave an empty line between paragraphs.",
          },
          {
            kind: "textarea",
            path: "research.introEs",
            label: "Introduction (Spanish)",
            hint: "The Spanish text, shown under the English one.",
          },
          {
            kind: "image",
            path: "research.image",
            label: "Picture",
            hint: "Shown beside the text, for example a photo of you. Optional.",
          },
        ],
      },
      {
        id: "documents",
        title: "Documents",
        fields: [
          {
            kind: "list",
            path: "research.documents",
            label: "Documents and links",
            hint: "Papers, posters or slides visitors can open, in this order.",
            itemLabel: "Document",
            addLabel: "Add a document",
            fields: [
              { kind: "text", path: "labelEn", label: "Name (English)", hint: "What the link says on the English side." },
              { kind: "text", path: "labelEs", label: "Name (Spanish)", hint: "What the link says on the Spanish side." },
              {
                kind: "url",
                path: "href",
                label: "Link",
                hint: "The full web address, starting with https://",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "contact",
    title: "Contact page",
    description: "The message form and the words around it.",
    publicPath: "/contact",
    sections: [
      {
        id: "intro",
        title: "Words and picture",
        fields: [
          { kind: "text", path: "contact.title", label: "Page title", hint: "The heading at the top of the Contact page." },
          {
            kind: "textarea",
            path: "contact.intro",
            label: "Introduction",
            hint: "A short invitation shown above the form.",
          },
          { kind: "image", path: "contact.image", label: "Picture", hint: "Shown next to the form. Optional." },
        ],
      },
      {
        id: "form",
        title: "Message form",
        hint: "The words on the form itself.",
        fields: [
          { kind: "text", path: "contact.form.nameLabel", label: "Name box label", hint: "Shown above the box for the visitor's name." },
          { kind: "text", path: "contact.form.emailLabel", label: "Email box label", hint: "Shown above the box for the visitor's email." },
          { kind: "text", path: "contact.form.messageLabel", label: "Message box label", hint: "Shown above the big message box." },
          { kind: "text", path: "contact.form.submitLabel", label: "Send button", hint: "The words on the button that sends the message." },
          {
            kind: "textarea",
            path: "contact.form.successMessage",
            label: "Thank-you message",
            hint: "Shown after a message was sent.",
          },
          {
            kind: "textarea",
            path: "contact.form.errorMessage",
            label: "Problem message",
            hint: "Shown if a message could not be sent.",
          },
        ],
      },
    ],
  },
  {
    key: "site",
    title: "Whole site",
    description: "Site name, menu words, footer and how the site appears in search results.",
    publicPath: "/",
    sections: [
      {
        id: "identity",
        title: "Name and search results",
        fields: [
          { kind: "text", path: "site.name", label: "Site name", hint: "Your name as shown at the top of every page." },
          {
            kind: "text",
            path: "site.metaTitle",
            label: "Title in search results",
            hint: "The blue headline Google shows for your site, and the browser tab name.",
            maxLength: 70,
          },
          {
            kind: "textarea",
            path: "site.metaDescription",
            label: "Description in search results",
            hint: "One or two sentences Google may show under the headline.",
            maxLength: 160,
          },
        ],
      },
      {
        id: "nav",
        title: "Menu",
        hint: "The words in the menu at the top of every page.",
        fields: [
          { kind: "text", path: "site.nav.home", label: "Home", hint: "Menu word for the home page." },
          { kind: "text", path: "site.nav.about", label: "About", hint: "Menu word for the About page." },
          { kind: "text", path: "site.nav.portfolio", label: "Portfolio", hint: "Menu word for the Portfolio page." },
          { kind: "text", path: "site.nav.research", label: "Research", hint: "Menu word for the Research page." },
          { kind: "text", path: "site.nav.contact", label: "Contact", hint: "Menu word for the Contact page." },
        ],
      },
      {
        id: "footer",
        title: "Footer",
        hint: "The bottom of every page repeats the menu words; the follow link is set here.",
        fields: [
          { kind: "text", path: "site.footer.followLabel", label: "Follow link words", hint: "For example: Follow on Instagram." },
          {
            kind: "url",
            path: "site.footer.followUrl",
            label: "Follow link address",
            hint: "The full web address the follow link opens, starting with https://",
          },
        ],
      },
    ],
  },
];

/** Labels and hints for the artwork editor (artworks are edited on their own screen). */
export const ARTWORK_FIELDS: TextField[] = [
  { kind: "text", path: "title", label: "Title", hint: "The painting's name." },
  { kind: "text", path: "medium", label: "Medium", hint: "For example: Acrylic on panel." },
  { kind: "text", path: "size", label: "Size", hint: "For example: 12 x 16 in." },
  { kind: "text", path: "year", label: "Year", hint: "When it was made. Can be left empty." },
  {
    kind: "textarea",
    path: "description",
    label: "Description",
    hint: "Shown with the painting on the site. Can be left empty.",
  },
];

export const ALT_TEXT_HINT =
  "Describe the picture in a few words for people who cannot see it, for example: Heron standing in a misty marsh.";

export function getPageDef(key: string): PageDef | undefined {
  return PAGES.find((p) => p.key === key);
}

/**
 * All string paths the registry covers, in schema notation ("[]" for array
 * items). Used by the coverage test.
 */
export function registeredStringPaths(): Set<string> {
  const out = new Set<string>();
  for (const page of PAGES) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        switch (field.kind) {
          case "text":
          case "textarea":
          case "url":
            out.add(field.path);
            break;
          case "image":
            out.add(`${field.path}.alt`);
            break;
          case "imageList":
            out.add(`${field.path}[].alt`);
            break;
          case "artworkPick":
            out.add(`${field.path}[]`);
            break;
          case "list":
            for (const f of field.fields) out.add(`${field.path}[].${f.path}`);
            break;
        }
      }
    }
  }
  return out;
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Immutable set: returns a copy of obj with path replaced by value. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const src = (obj ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = Array.isArray(src) ? ([...src] as unknown as Record<string, unknown>) : { ...src };
  copy[head as string] = rest.length === 0 ? value : setPath(src[head as string], rest.join("."), value);
  return copy as T;
}
