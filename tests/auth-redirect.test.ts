import { GET as magicLink } from "@/app/api/auth/magic-link/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { issueLoginLinkToken } from "@/lib/auth/magic-link";
import { seeOther } from "@/lib/auth/redirect";

// On Netlify, req.url can be the deploy's own <id>--rowennkalman.netlify.app host. A redirect
// built from it sent signed-in users to a host without their cookie (2026-09-30).
const DEPLOY_HOST = "https://6abd45d90e80cb0008129777--rowennkalman.netlify.app";
const SECRET = "x".repeat(40);

beforeAll(() => {
  process.env.ROWENNKALMAN_SESSION_SECRET = SECRET;
  process.env.ROWENNKALMAN_ADMIN_EMAILS = "editor@example.com";
});

describe("auth redirects stay on the browser's host", () => {
  it("a valid sign-in link sets the cookie and redirects with a relative Location", async () => {
    const token = await issueLoginLinkToken("editor@example.com", "/admin/about", new TextEncoder().encode(SECRET));
    const res = await magicLink(new Request(`${DEPLOY_HOST}/api/auth/magic-link?token=${token}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/about");
    expect(res.headers.get("set-cookie")).toMatch(/.+=.+/);
  });

  it("an expired or forged link goes back to the login page, relatively", async () => {
    const res = await magicLink(new Request(`${DEPLOY_HOST}/api/auth/magic-link?token=bogus`));
    expect(res.headers.get("location")).toBe("/admin/login?error=expired");
  });

  it("sign-out redirects relatively", async () => {
    const res = await logout();
    expect(res.headers.get("location")).toBe("/admin/login?signedOut=1");
  });

  it("refuses anything that is not a same-site path", () => {
    expect(() => seeOther("https://evil.test/")).toThrow();
    expect(() => seeOther("//evil.test/")).toThrow();
  });
});
