/** @jest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import { VisitsBody } from "@/app/admin/_components/VisitsCard";

describe("VisitsBody", () => {
  it("shows the three totals and the top lists", () => {
    render(
      <VisitsBody
        stats={{ allTime: 1234, last30: 200, last7: 40, pages: [{ name: "/about", count: 7 }], referrers: [], countries: [] }}
      />,
    );
    expect(screen.getByText("All time").nextSibling).toHaveTextContent("1,234");
    const pages = screen.getByRole("heading", { name: "Top pages" }).parentElement!;
    expect(within(pages).getByText("/about")).toBeInTheDocument();
    expect(screen.getAllByText("None yet.")).toHaveLength(2);
  });
});
