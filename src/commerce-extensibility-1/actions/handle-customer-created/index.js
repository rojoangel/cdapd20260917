import { initialize, getConfigurationByKey, byCodeAndLevel } from "@adobe/aio-commerce-lib-config";
import { createWebhookCaptureSession, postWebhookCaptureUpdate } from "./webhook-capture-client.js";

const DEFAULT_BASE_URL = "https://aisenseapi.com/services/v1/webhook_capture";
let configInitialized = false;

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  return "";
}

function parseTime(value) {
  const iso = toIsoString(value);
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

function isGenuinelyNewCustomer(createdAt, updatedAt) {
  const created = parseTime(createdAt);
  const updated = parseTime(updatedAt);
  if (created === null || updated === null) {
    return false;
  }
  return Math.abs(created - updated) <= 1000;
}

function getLogger(params) {
  return params?.logger ?? console;
}

function logError(logger, message, context, error) {
  logger.error?.(message, { ...context, error: error?.message ?? String(error) });
}

async function loadConfiguredBaseUrl(params, logger) {
  if (!configInitialized) {
    await initialize({ schema: params.schema });
    configInitialized = true;
  }
  try {
    const { config } = await getConfigurationByKey("welcome_service_base_url", byCodeAndLevel("global", "global"));
    const value = typeof config?.value === "string" ? config.value.trim() : "";
    return value || DEFAULT_BASE_URL;
  } catch (error) {
    logError(logger, "Failed to read welcome_service_base_url config", {}, error);
    return DEFAULT_BASE_URL;
  }
}

export async function main(params) {
  const logger = getLogger(params);
  try {
    const event = params?.data?.value ?? {};
    const email = typeof event.email === "string" ? event.email.trim() : "";
    const createdAt = event.created_at;
    const updatedAt = event.updated_at;

    if (!email || !isGenuinelyNewCustomer(createdAt, updatedAt)) {
      return { statusCode: 200, body: { skipped: true, reason: "not-a-new-customer" } };
    }

    const baseUrl = await loadConfiguredBaseUrl(params, logger);
    const session = await createWebhookCaptureSession(baseUrl, logger);
    await postWebhookCaptureUpdate(session.update_url, { email, created_at: toIsoString(createdAt) }, logger);

    return { statusCode: 200, body: { capture_id: session.capture_id } };
  } catch (error) {
    logError(logger, "handle-customer-created failed", {}, error);
    return { statusCode: 500, body: { success: false, error: "Failed to notify welcome service" } };
  }
}
