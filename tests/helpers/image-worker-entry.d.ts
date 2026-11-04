declare const worker: {
  fetch: (request: Request, env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) => Promise<Response>;
};
export default worker;
