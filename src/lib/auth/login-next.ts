/** Only same-site admin paths are allowed as a post-login destination. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/admin";
  if (!/^\/admin(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_-]*)?$/.test(next) || next.startsWith("/admin/login")) return "/admin";
  return next;
}
