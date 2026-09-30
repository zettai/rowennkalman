/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import seed from "@content/seed.json";
import { ContactForm } from "@/lib/contact";

const labels = seed.contact.form;

function mockFetch(status: number, body: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return { ok: status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("ContactForm", () => {
  it("renders the labels from content", () => {
    render(<ContactForm labels={labels} />);
    expect(screen.getByLabelText(labels.nameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(labels.emailLabel)).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(labels.messageLabel).tagName).toBe("TEXTAREA");
    expect(screen.getByRole("button", { name: labels.submitLabel })).toBeInTheDocument();
  });

  it("posts JSON with an empty honeypot and startedAt, then shows the success message", async () => {
    const calls = mockFetch(200, { ok: true });
    const user = userEvent.setup();
    render(<ContactForm labels={labels} />);
    await user.type(screen.getByLabelText(labels.nameLabel), "Test Person");
    await user.type(screen.getByLabelText(labels.emailLabel), "test@example.com");
    await user.type(screen.getByLabelText(labels.messageLabel), "Hello");
    await user.click(screen.getByRole("button", { name: labels.submitLabel }));
    await waitFor(() => expect(screen.getByText(labels.successMessage)).toBeInTheDocument());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/contact");
    expect(calls[0]!.body).toMatchObject({ name: "Test Person", email: "test@example.com", message: "Hello", website: "" });
    expect(typeof calls[0]!.body.startedAt).toBe("number");
    expect(screen.getByLabelText(labels.nameLabel)).toHaveValue("");
  });

  it("shows the error message when sending fails", async () => {
    mockFetch(502, { ok: false });
    const user = userEvent.setup();
    render(<ContactForm labels={labels} />);
    await user.type(screen.getByLabelText(labels.nameLabel), "A");
    await user.type(screen.getByLabelText(labels.emailLabel), "a@example.com");
    await user.type(screen.getByLabelText(labels.messageLabel), "Hi");
    await user.click(screen.getByRole("button", { name: labels.submitLabel }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(labels.errorMessage));
  });

  it("keeps the honeypot out of the accessibility tree and tab order", () => {
    const { container } = render(<ContactForm labels={labels} />);
    const pot = container.querySelector('input[name="website"]')!;
    expect(pot).toHaveAttribute("tabindex", "-1");
    expect(pot.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
