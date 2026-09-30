import "@testing-library/jest-dom";

// Tests must never reach the network. Any unmocked fetch fails loudly.
globalThis.fetch = (async (input: unknown) => {
  throw new Error(`Network access in tests is forbidden: ${String(input)}`);
}) as typeof fetch;
