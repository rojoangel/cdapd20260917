import { createWebhookCaptureSession, postWebhookCaptureUpdate } from "./webhook-capture-client.js";

describe("webhook-capture-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.restoreAllMocks();
  });

  it("creates a capture session and posts the update payload", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ capture_id: "cap-123", update_url: "https://example.test/update" }) });
    fetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const session = await createWebhookCaptureSession("https://example.test/capture", console);
    const update = await postWebhookCaptureUpdate(session.update_url, { email: "a@example.com", created_at: "2024-01-01T00:00:00.000Z" }, console);

    expect(session).toEqual({ capture_id: "cap-123", update_url: "https://example.test/update" });
    expect(update).toEqual({ statusCode: 200 });
    expect(fetch).toHaveBeenNthCalledWith(1, "https://example.test/capture", { method: "POST" });
    expect(fetch).toHaveBeenNthCalledWith(2, "https://example.test/update", expect.objectContaining({ method: "POST" }));
  });

  it("retries transient failures and throws after exhausting attempts", async () => {
    const warn = jest.fn();
    const logger = { warn, error: jest.fn() };
    fetch.mockResolvedValue({ ok: false, status: 503, text: async () => "temporarily unavailable" });

    await expect(createWebhookCaptureSession("https://example.test/capture", logger)).rejects.toThrow("Unexpected response 503");
    expect(warn).toHaveBeenCalled();
  });
});
