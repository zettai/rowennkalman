/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import { CountPageViews } from "@/components/site/CountPageViews";

let mockPath = "/";
jest.mock("next/navigation", () => ({ usePathname: () => mockPath }));

describe("CountPageViews", () => {
  it("leaves the first page to count.js and reports each client-side navigation", () => {
    const count = jest.fn();
    (window as unknown as { goatcounter: unknown }).goatcounter = { count };
    const view = render(<CountPageViews />);
    expect(count).not.toHaveBeenCalled();
    mockPath = "/contact";
    view.rerender(<CountPageViews />);
    expect(count).toHaveBeenCalledWith({ path: "/contact" });
    view.rerender(<CountPageViews />);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("does nothing when count.js has not loaded (blocked or still loading)", () => {
    delete (window as unknown as { goatcounter?: unknown }).goatcounter;
    mockPath = "/";
    const view = render(<CountPageViews />);
    mockPath = "/about";
    expect(() => view.rerender(<CountPageViews />)).not.toThrow();
  });
});
