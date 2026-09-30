/** @jest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "@content/seed.json";
import { ContentSchema } from "@/lib/content/schema";
import { PAGES } from "@/lib/content/fields";
import { PageEditor } from "@/app/admin/_components/PageEditor";
import { PortfolioEditor } from "@/app/admin/_components/PortfolioEditor";
import { CONFLICT_MESSAGE } from "@/app/admin/_components/EditorShell";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const content = ContentSchema.parse(seed);
const urls = { "art/seed-hero.jpg": "/x/hero.jpg" } as Record<string, string>;

function mockSave(status: number, body: unknown) {
  const calls: Record<string, unknown>[] = [];
  globalThis.fetch = jest.fn(async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string));
    return { ok: status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("page editor", () => {
  it("shows every registry field of the page with its label and hint", () => {
    render(<PageEditor page="contact" content={content} imageUrls={urls} />);
    const def = PAGES.find((p) => p.key === "contact")!;
    for (const section of def.sections) {
      expect(screen.getByRole("heading", { name: section.title })).toBeInTheDocument();
      for (const field of section.fields) {
        if (field.kind === "image") expect(screen.getByRole("group", { name: field.label })).toBeInTheDocument();
        else expect(screen.getByLabelText(field.label)).toHaveAccessibleDescription(expect.stringContaining(field.hint));
      }
    }
  });

  it("saves only its page with the concurrency token, then reports success", async () => {
    const saved = { ...content, updatedAt: "2026-02-02T00:00:00.000Z", home: { ...content.home, heroTitle: "Marsh light" } };
    const calls = mockSave(200, { content: saved, imageUrls: urls });
    const user = userEvent.setup();
    render(<PageEditor page="home" content={content} imageUrls={urls} />);
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    await user.clear(screen.getByLabelText("Your name (big title)"));
    await user.type(screen.getByLabelText("Your name (big title)"), "Marsh light");
    expect(screen.getByTestId("save-status")).toHaveTextContent("You have unsaved changes.");
    await user.click(save);
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("Saved. Your changes are live on the site."));
    expect(calls[0]).toEqual({ page: "home", value: { ...content.home, heroTitle: "Marsh light" }, expectedUpdatedAt: content.updatedAt });
    expect(save).toBeDisabled();
  });

  it("shows the conflict message and a Reload button on 409", async () => {
    mockSave(409, { error: "conflict" });
    const user = userEvent.setup();
    render(<PageEditor page="home" content={content} imageUrls={urls} />);
    await user.type(screen.getByLabelText("Your name (big title)"), "!");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent(CONFLICT_MESSAGE));
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    // A prominent notice at the top too, with its own reload button, warning that reloading drops the edit.
    const notice = screen.getByTestId("outdated-notice");
    expect(notice).toHaveTextContent("Not saved: this page was changed somewhere else");
    expect(notice).toHaveTextContent("copy any text you want to keep");
    expect(within(notice).getByRole("button", { name: "Reload the latest version" })).toBeInTheDocument();
    // The edit is kept.
    expect(screen.getByLabelText("Your name (big title)")).toHaveValue(`${content.home.heroTitle}!`);
  });

  it("keeps changes and explains a network failure", async () => {
    globalThis.fetch = jest.fn(async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<PageEditor page="home" content={content} imageUrls={urls} />);
    await user.type(screen.getByLabelText("Your name (big title)"), "?");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("Your changes are still here"));
  });

  it("adds, reorders and removes research documents without browser dialogs", async () => {
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, "confirm");
    render(<PageEditor page="research" content={content} imageUrls={urls} />);
    await user.click(screen.getByRole("button", { name: "+ Add a document" }));
    expect(screen.getAllByLabelText("Name (English)")).toHaveLength(2);
    await user.type(screen.getAllByLabelText("Name (English)")[1]!, "Poster");
    await user.click(screen.getByRole("button", { name: "Move Document 2 up" }));
    expect(screen.getAllByLabelText("Name (English)")[0]).toHaveValue("Poster");
    await user.click(screen.getAllByRole("button", { name: "Remove…" })[0]!);
    await user.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(screen.getAllByLabelText("Name (English)")).toHaveLength(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe("portfolio editor", () => {
  it("lists artworks in order and moves one with accessible buttons", async () => {
    const user = userEvent.setup();
    render(<PortfolioEditor content={content} imageUrls={urls} />);
    const titles = () => screen.getAllByTestId("artwork-card").map((c) => within(c).getByText(/Placeholder Artwork/).textContent);
    expect(titles()).toEqual(["Placeholder Artwork One", "Placeholder Artwork Two", "Placeholder Artwork Three"]);
    expect(screen.getByRole("button", { name: "Move “Placeholder Artwork One” up" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move “Placeholder Artwork Three” up" }));
    expect(titles()).toEqual(["Placeholder Artwork One", "Placeholder Artwork Three", "Placeholder Artwork Two"]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Move “Placeholder Artwork Three” up" })).toHaveFocus());
    expect(screen.getByText(/Moved “Placeholder Artwork Three” to position 2 of 3/)).toBeInTheDocument();
  });

  it("deletes with an inline confirm that can be cancelled", async () => {
    const user = userEvent.setup();
    render(<PortfolioEditor content={content} imageUrls={urls} />);
    const card = screen.getAllByTestId("artwork-card")[1]!;
    await user.click(within(card).getByRole("button", { name: "Delete…" }));
    await user.click(within(card).getByRole("button", { name: "Keep it" }));
    expect(screen.getAllByTestId("artwork-card")).toHaveLength(3);
    await user.click(within(card).getByRole("button", { name: "Delete…" }));
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    await user.click(within(card).getByRole("button", { name: "Yes, delete" }));
    expect(screen.getAllByTestId("artwork-card")).toHaveLength(2);
    // The image was saved content, so nothing is discarded before Save.
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("save-status")).toHaveTextContent("You have unsaved changes.");
  });
});

describe("choosing paintings from the portfolio", () => {
  const artUrls = Object.fromEntries(content.portfolio.artworks.map((a) => [a.image.key, `/x/${a.id}.jpg`]));

  it("home: picks paintings in click order, takes one out again, and saves their ids", async () => {
    const calls = mockSave(200, { content, imageUrls: urls });
    const user = userEvent.setup();
    const none = { ...content, home: { ...content.home, featured: [] } };
    render(<PageEditor page="home" content={none} imageUrls={{ ...urls, ...artUrls }} />);
    const group = screen.getByRole("group", { name: "Chosen paintings" });
    const buttons = within(group).getAllByRole("button");
    await user.click(buttons[2]!);
    await user.click(buttons[0]!);
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByText("2 of 3 chosen.")).toBeInTheDocument();
    await user.click(buttons[2]!); // take it out again
    expect(buttons[2]).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]!.value as { featured: string[] }).featured).toEqual([content.portfolio.artworks[0]!.id]);
  });

  it("uses a portfolio painting for a picture field without uploading", async () => {
    const calls = mockSave(200, { content, imageUrls: urls });
    const user = userEvent.setup();
    const noPicture = { ...content, contact: { ...content.contact, image: null } };
    render(<PageEditor page="contact" content={noPicture} imageUrls={{ ...urls, ...artUrls }} />);
    await user.click(screen.getByText("Use a painting from your portfolio"));
    const art = content.portfolio.artworks[1]!;
    await user.click(screen.getByRole("button", { name: new RegExp(art.title) }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]!.value as { image: { key: string } }).image.key).toBe(art.image.key);
  });
});

describe("stale-page warning", () => {
  it("warns when the site was saved elsewhere since the page was opened, on returning to the tab", async () => {
    const newer = { ...content, updatedAt: "2099-01-01T00:00:00.000Z" };
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: newer }) }) as Response) as unknown as typeof fetch;
    render(<PageEditor page="home" content={content} imageUrls={urls} />);
    expect(screen.queryByTestId("outdated-notice")).not.toBeInTheDocument();
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(screen.getByTestId("outdated-notice")).toHaveTextContent("This page was changed somewhere else"));
  });

  it("stays quiet when nothing changed", async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ content }) }) as Response) as unknown as typeof fetch;
    render(<PageEditor page="home" content={content} imageUrls={urls} />);
    window.dispatchEvent(new Event("focus"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("outdated-notice")).not.toBeInTheDocument();
  });
});
