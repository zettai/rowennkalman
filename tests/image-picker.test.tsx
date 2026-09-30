/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagePicker } from "@/app/admin/_components/ImagePicker";
import { UploadError, type UploadProgress } from "@/lib/upload/client";

const mockUpload = jest.fn();
jest.mock("@/lib/upload/client", () => {
  const actual = jest.requireActual("@/lib/upload/client");
  return { ...actual, uploadImage: (...args: unknown[]) => mockUpload(...args) };
});

const file = new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" });
const steps = () =>
  screen.getAllByRole("listitem").map((li) => `${li.getAttribute("data-state")}:${li.querySelector("span:last-child")?.textContent}`);

describe("ImagePicker progress panel", () => {
  beforeEach(() => mockUpload.mockReset());

  it("walks through the steps with the sending percentage, then hands over the result", async () => {
    let report: (p: UploadProgress) => void = () => {};
    let finish: (v: unknown) => void = () => {};
    mockUpload.mockImplementation((_f, _a, opts: { onProgress: (p: UploadProgress) => void }) => {
      report = opts.onProgress;
      return new Promise((r) => (finish = r));
    });
    const onUploaded = jest.fn();
    const onBusy = jest.fn();
    render(<ImagePicker label="Add picture" onUploaded={onUploaded} onBusyChange={onBusy} testId="pick" />);
    await userEvent.upload(screen.getByTestId("pick"), file);
    expect(steps()[0]).toMatch(/^active:Preparing/);
    expect(screen.queryByText("Add picture")).toBeNull(); // the button makes way for the panel
    report({ step: "send", percent: 42 });
    await waitFor(() => expect(steps()).toEqual([
      "done:Preparing the picture on this device",
      "active:Sending… 42%",
      "waiting:Saving it and making sizes for phones and computers",
    ]));
    report({ step: "sizes" });
    await waitFor(() => expect(steps()[2]).toMatch(/^active:Saving/));
    finish({ image: { key: "art/x.jpg" }, url: "u", id: "u-1234" });
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(screen.queryByTestId("upload-progress")).toBeNull();
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it("names the failed step, shows the reference, and retries with the same file", async () => {
    mockUpload.mockRejectedValueOnce(new UploadError("The picture could not be sent. Check your internet connection and try again.", "send", "u-9zz9"));
    mockUpload.mockResolvedValueOnce({ image: { key: "art/x.jpg" }, url: "u", id: "u-2" });
    const onUploaded = jest.fn();
    render(<ImagePicker label="Add picture" onUploaded={onUploaded} testId="pick" />);
    await userEvent.upload(screen.getByTestId("pick"), file);
    await screen.findByRole("alert");
    expect(steps()).toEqual([
      "done:Preparing the picture on this device",
      "failed:Sending",
      "waiting:Saving it and making sizes for phones and computers",
    ]);
    expect(screen.getByText("Reference: u-9zz9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload.mock.calls[1]![0]).toBe(file);
  });
});
