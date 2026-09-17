import { main } from "./index.js";
import * as client from "./webhook-capture-client.js";
import * as config from "@adobe/aio-commerce-lib-config";

jest.unstable_mockModule("./webhook-capture-client.js", () => ({
  createWebhookCaptureSession: jest.fn(),
  postWebhookCaptureUpdate: jest.fn(),
}));

jest.unstable_mockModule("@adobe/aio-commerce-lib-config", () => ({
  initialize: jest.fn(),
  getConfigurationByKey: jest.fn(),
  byCodeAndLevel: jest.fn(() => ({})),
}));

describe("handle-customer-created", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("notifies the welcome service for a new customer", async () => {
    config.getConfigurationByKey.mockResolvedValue({ config: { value: "https://merchant.example/welcome" } });
    client.createWebhookCaptureSession.mockResolvedValue({ capture_id: "cap-123", update_url: "https://merchant.example/update" });
    client.postWebhookCaptureUpdate.mockResolvedValue({ statusCode: 200 });

    const result = await main({
      schema: [],
      data: { value: { email: "a@example.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00.500Z" } },
      logger: { error: jest.fn(), warn: jest.fn() },
    });

    expect(result.body.capture_id).toBe("cap-123");
    expect(client.createWebhookCaptureSession).toHaveBeenCalledWith("https://merchant.example/welcome", expect.any(Object));
    expect(client.postWebhookCaptureUpdate).toHaveBeenCalledWith("https://merchant.example/update", { email: "a@example.com", created_at: "2024-01-01T00:00:00.000Z" }, expect.any(Object));
  });

  it("skips updates", async () => {
    const result = await main({ data: { value: { email: "a@example.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-02T00:00:00Z" } }, logger: { error: jest.fn(), warn: jest.fn() } });
    expect(result.body.skipped).toBe(true);
    expect(client.createWebhookCaptureSession).not.toHaveBeenCalled();
  });

  it("falls back to the default base URL when config is empty", async () => {
    config.getConfigurationByKey.mockResolvedValue({ config: { value: "" } });
    client.createWebhookCaptureSession.mockResolvedValue({ capture_id: "cap-1", update_url: "https://merchant.example/update" });
    client.postWebhookCaptureUpdate.mockResolvedValue({ statusCode: 200 });

    await main({
      schema: [],
      data: { value: { email: "a@example.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00.300Z" } },
      logger: { error: jest.fn(), warn: jest.fn() },
    });

    expect(client.createWebhookCaptureSession).toHaveBeenCalledWith("https://aisenseapi.com/services/v1/webhook_capture", expect.any(Object));
  });

  it("uses an overridden merchant base URL when provided", async () => {
    config.getConfigurationByKey.mockResolvedValue({ config: { value: "https://merchant.example/welcome" } });
    client.createWebhookCaptureSession.mockResolvedValue({ capture_id: "cap-2", update_url: "https://merchant.example/update" });
    client.postWebhookCaptureUpdate.mockResolvedValue({ statusCode: 200 });

    await main({
      schema: [],
      data: { value: { email: "b@example.com", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00.750Z" } },
      logger: { error: jest.fn(), warn: jest.fn() },
    });

    expect(client.createWebhookCaptureSession).toHaveBeenCalledWith("https://merchant.example/welcome", expect.any(Object));
  });
});
