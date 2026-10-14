import { describe, it, expect, vi, afterEach } from "vitest";
import { isWebhookUrlFor } from "shared-types";
import { sendDiscord, sendEmail, sendSlack } from "./send";

// The URL rule is what stops the api POSTing to an attacker's chosen address
// (SSRF). Every bypass trick below must be refused.
describe("isWebhookUrlFor", () => {
  it("accepts real webhook URLs", () => {
    expect(isWebhookUrlFor("SLACK", "https://hooks.slack.com/services/T000/B000/XXXX")).toBe(true);
    expect(isWebhookUrlFor("DISCORD", "https://discord.com/api/webhooks/123/abc")).toBe(true);
    expect(isWebhookUrlFor("DISCORD", "https://discordapp.com/api/webhooks/123/abc")).toBe(true);
  });

  it.each([
    ["cloud metadata", "http://169.254.169.254/computeMetadata/v1/"],
    ["lookalike host", "https://hooks.slack.com.evil.com/services/x"],
    ["userinfo trick", "https://hooks.slack.com@evil.com/services/x"],
    ["odd port", "https://hooks.slack.com:8080/services/x"],
    ["plain http", "http://hooks.slack.com/services/x"],
    ["wrong path", "https://hooks.slack.com/admin"],
    ["localhost", "https://localhost/services/x"],
    ["not a URL", "hooks.slack.com/services/x"],
  ])("refuses %s for SLACK", (_label, url) => {
    expect(isWebhookUrlFor("SLACK", url)).toBe(false);
  });

  it.each([
    ["lookalike host", "https://discord.com.evil.com/api/webhooks/1/x"],
    ["userinfo trick", "https://discord.com@evil.com/api/webhooks/1/x"],
    ["slack url", "https://hooks.slack.com/services/T0/B0/x"],
  ])("refuses %s for DISCORD", (_label, url) => {
    expect(isWebhookUrlFor("DISCORD", url)).toBe(false);
  });
});

describe("senders", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never makes a request to a URL that fails the rule", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await sendSlack("http://169.254.169.254/", "hi")).toEqual({ ok: false, reason: "rejected" });
    expect(await sendDiscord("https://discord.com@evil.com/api/webhooks/1/x", "hi")).toEqual({ ok: false, reason: "rejected" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports not_configured for email with no API key, without a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await sendEmail({ apiKey: "", from: "a@b.c" }, ["x@y.z"], "s", "t")).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to follow redirects and gives up after a timeout", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendDiscord("https://discord.com/api/webhooks/1/x", "hi")).toEqual({ ok: true });
    const opts = fetch.mock.calls[0][1];
    expect(opts.redirect).toBe("error");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps provider errors and network failures to reasons", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no_service", { status: 404 })));
    expect(await sendSlack("https://hooks.slack.com/services/T/B/x", "hi")).toEqual({
      ok: false,
      reason: "rejected",
      status: 404,
    });

    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    expect(await sendSlack("https://hooks.slack.com/services/T/B/x", "hi")).toEqual({ ok: false, reason: "timeout" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await sendSlack("https://hooks.slack.com/services/T/B/x", "hi")).toEqual({ ok: false, reason: "unreachable" });
  });

  it("caps Discord messages at 2000 characters", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await sendDiscord("https://discord.com/api/webhooks/1/x", "x".repeat(5000));
    expect(JSON.parse(fetch.mock.calls[0][1].body).content).toHaveLength(2000);
  });
});
