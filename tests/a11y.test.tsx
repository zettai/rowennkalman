/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import seed from "@content/seed.json";
import { ContentSchema } from "@/lib/content/schema";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Gallery } from "@/components/site/Gallery";
import { ContactForm } from "@/components/site/ContactForm";
import { Painting } from "@/components/site/Painting";
import { NavLinks } from "@/components/site/NavLinks";

jest.mock("@/lib/store", () => ({ getStore: jest.fn() }));
jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: (props: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
    const { href, children, ...rest } = props;
    delete rest.prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const content = ContentSchema.parse(seed);
const image = (n: number) => ({
  key: `art/${n}.jpg`,
  width: 800,
  height: 600,
  alt: `Painting ${n} alt`,
  blur: "data:image/jpeg;base64,AAAA",
});
const art = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  image: image(n),
  title: n === 1 ? "Star tree" : "",
  medium: n === 1 ? "Acrylic" : "",
  size: n === 1 ? "6 x 6 in" : "",
  year: n === 1 ? "2024" : "",
  description: n === 1 ? "Night." : "",
  src: `/img/${n}.jpg`,
});

const formLabels = {
  nameLabel: "Name",
  emailLabel: "Email",
  messageLabel: "Message",
  submitLabel: "Send",
  successMessage: "Thank you!",
  errorMessage: "Something went wrong.",
};

describe("accessibility (jest-axe)", () => {
  it("site chrome (skip link, header, main, footer) has no violations", async () => {
    const { container } = render(
      <>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header site={content.site} />
        <main id="main">
          <h1>Home</h1>
          <p>Sample page body.</p>
        </main>
        <Footer site={content.site} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("header with the mobile menu open has no violations", async () => {
    const user = userEvent.setup();
    const { container } = render(<Header site={content.site} />);
    await user.click(container.querySelector("summary")!);
    expect(container.querySelector("details")).toHaveAttribute("open");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("nav links mark the current page", async () => {
    const { container } = render(
      <nav aria-label="Main">
        <NavLinks items={[{ href: "/", label: "Home" }, { href: "/about", label: "About" }]} />
      </nav>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("painting has no violations", async () => {
    const { container } = render(<Painting image={image(1)} src="/img/1.jpg" sizes="100vw" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("gallery closed and open lightbox have no violations", async () => {
    const user = userEvent.setup();
    const { container } = render(<Gallery items={[art(1), art(2), art(3)]} />);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(container.querySelectorAll<HTMLButtonElement>(".gallery-thumb")[0]!);
    expect(container.querySelector("dialog")).toHaveAttribute("open");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("contact form has no violations", async () => {
    const { container } = render(<ContactForm labels={formLabels} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
