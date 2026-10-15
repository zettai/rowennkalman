/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { getStore } from "@/lib/store";

jest.mock("@/lib/store", () => ({ getStore: jest.fn() }));
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
jest.mock("next/navigation", () => ({ usePathname: () => "/missing" }));

describe("not-found page", () => {
  it("renders live site chrome without touching the content store", async () => {
    const getStoreMock = getStore as jest.Mock;
    getStoreMock.mockImplementation(() => {
      throw new Error("getStore must not be called from not-found");
    });

    const { default: NotFound } = await import("@/app/not-found");
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rowenn Beth Kalman" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "see the paintings" })).toHaveAttribute("href", "/portfolio");
    expect(screen.getByRole("link", { name: "Follow" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/rowennbeth/",
    );
    expect(screen.queryByText("Artist Name")).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.com/)).not.toBeInTheDocument();
    expect(getStoreMock).not.toHaveBeenCalled();
  });
});
