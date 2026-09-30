/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Painting } from "@/components/site/Painting";
import { Gallery } from "@/components/site/Gallery";
import { ContactForm } from "@/components/site/ContactForm";

// jsdom has no <dialog> behaviour: open/close like a browser does, including the close event.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const image = (n: number) => ({ key: `art/${n}.jpg`, width: 800, height: 600, alt: `Painting ${n} alt`, blur: "data:image/jpeg;base64,AAAA" });
const art = (n: number, extra: Partial<{ title: string; medium: string; size: string; year: string; description: string }> = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  image: image(n),
  title: "",
  medium: "",
  size: "",
  year: "",
  description: "",
  src: `/img/${n}.jpg`,
  ...extra,
});

describe("Painting", () => {
  it("shows the blurred preview at once and fades the picture in when it loads", async () => {
    const { container } = render(<Painting image={image(1)} src="/img/1.jpg" sizes="100vw" />);
    const frame = container.querySelector(".fi") as HTMLElement;
    expect(frame.style.backgroundImage).toContain("data:image/jpeg;base64,AAAA");
    const img = screen.getByAltText("Painting 1 alt");
    expect(img).toHaveAttribute("data-loaded", "false");
    expect(img).toHaveAttribute("loading", "lazy");
    fireEvent.load(img);
    await waitFor(() => expect(img).toHaveAttribute("data-loaded", "true"));
  });
  it("loads eagerly when asked, and priority pictures skip the fade", () => {
    render(<Painting image={image(2)} src="/img/2.jpg" sizes="100vw" eager />);
    expect(screen.getByAltText("Painting 2 alt")).toHaveAttribute("loading", "eager");
    render(<Painting image={image(3)} src="/img/3.jpg" sizes="100vw" priority layout="fill" />);
    expect(screen.getByAltText("Painting 3 alt")).toHaveAttribute("data-loaded", "true");
  });
});

describe("Gallery lightbox", () => {
  const items = [art(1, { title: "Star tree", medium: "Acrylic", size: "6 x 6 in", year: "2024", description: "Night." }), art(2), art(3)];

  it("shows titles and details under thumbnails when filled in", () => {
    render(<Gallery items={items} />);
    expect(screen.getAllByTestId("artwork-title").map((e) => e.textContent)).toEqual(["Star tree"]);
    expect(screen.getByText("Acrylic, 6 x 6 in, 2024")).toBeInTheDocument();
  });

  it("opens on a thumbnail, steps with the arrows, closes on the backdrop and returns focus", async () => {
    const user = userEvent.setup();
    const { container } = render(<Gallery items={items} />);
    const thumbs = container.querySelectorAll<HTMLButtonElement>(".gallery-thumb");
    await user.click(thumbs[0]!);
    const dialog = container.querySelector("dialog")!;
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByText("Night.")).toBeInTheDocument();
    expect(within(dialog).getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(within(dialog).getByText("3 / 3")).toBeInTheDocument(); // wraps around
    // The paintings either side are preloaded while one is open.
    expect(dialog.querySelectorAll("[hidden] img")).toHaveLength(2);
    // A click inside the content keeps it open; a click on the backdrop (the dialog itself) closes it.
    fireEvent.click(within(dialog).getByText("3 / 3"));
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute("open");
    expect(document.activeElement).toBe(thumbs[0]);
  });

  it("closes with its Close button", async () => {
    const user = userEvent.setup();
    const { container } = render(<Gallery items={items} />);
    await user.click(container.querySelectorAll<HTMLButtonElement>(".gallery-thumb")[1]!);
    await user.click(screen.getByRole("button", { name: "Close", hidden: true }));
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");
  });
});

describe("Contact form (public site)", () => {
  const labels = {
    nameLabel: "Name",
    emailLabel: "Email",
    messageLabel: "Message",
    submitLabel: "Send",
    successMessage: "Thank you!",
    errorMessage: "Something went wrong.",
  };

  it("posts the contract shape, with the honeypot and the start time, then thanks the visitor", async () => {
    const calls: Record<string, unknown>[] = [];
    globalThis.fetch = jest.fn(async (_u: string, init: RequestInit) => {
      calls.push(JSON.parse(init.body as string));
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<ContactForm labels={labels} />);
    await user.type(screen.getByLabelText(/Name/), "Ana");
    await user.type(screen.getByLabelText(/Email/), "ana@example.com");
    await user.type(screen.getByLabelText(/Message/), "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Thank you!")).toBeInTheDocument());
    expect(calls[0]).toMatchObject({ name: "Ana", email: "ana@example.com", message: "Hello", website: "" });
    expect(typeof calls[0]!.startedAt).toBe("number");
  });

  it("shows the error message when sending fails, and keeps the form", async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false }) as Response) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<ContactForm labels={labels} />);
    await user.type(screen.getByLabelText(/Name/), "Ana");
    await user.type(screen.getByLabelText(/Email/), "ana@example.com");
    await user.type(screen.getByLabelText(/Message/), "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("mobile menu", () => {
  it("closes after a page is chosen", async () => {
    const { NavLinks } = await import("@/components/site/NavLinks");
    const { container } = render(
      <details open>
        <summary>Menu</summary>
        <NavLinks items={[{ href: "/", label: "Home" }, { href: "/about", label: "About" }]} />
      </details>,
    );
    const details = container.querySelector("details")!;
    expect(details).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(details).not.toHaveAttribute("open");
  });
});
