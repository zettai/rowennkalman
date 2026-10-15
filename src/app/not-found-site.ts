import type { Content } from "@/lib/content/schema";

/**
 * Static site chrome for the root 404 page.
 * Admin edits to site name/nav/footer do not reach this page — deliberate: Next
 * prerenders /_not-found at build time, so it must not read the content store.
 * Values match the live public site (rowennkalman.com), not content/seed.json.
 */
export const NOT_FOUND_SITE: Content["site"] = {
  name: "Rowenn Beth Kalman",
  metaTitle: "Rowenn Beth Kalman",
  metaDescription: "Page not found | Rowenn Beth Kalman",
  nav: {
    home: "Home",
    about: "About",
    portfolio: "Portfolio",
    research: "Research",
    contact: "Contact",
  },
  footer: {
    followLabel: "Follow",
    followUrl: "https://www.instagram.com/rowennbeth/",
    copyright: "Rowenn Beth Kalman",
  },
};
