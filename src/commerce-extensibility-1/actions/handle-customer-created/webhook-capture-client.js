const TRANSIENT_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [100, 250, 500];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStructuredLogger(logger = console) {
  return {
    warn(message, context) {
      logger.warn?.(message, context);
    },
    error(message, context) {
      logger.error?.(message, context);
    },
  };
}

async function requestWithRetry(url, options, logger, operation) {
  const structuredLogger = getStructuredLogger(logger);
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      const body = await response.text();
      const error = new Error(`Unexpected response ${response.status}`);
      error.status = response.status;
      error.body = body;
      if (!TRANSIENT_STATUS.has(response.status) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      structuredLogger.warn(`${operation} retrying after HTTP ${response.status}`, { url, attempt: attempt + 1, status: response.status });
      await sleep(RETRY_DELAYS_MS[attempt]);
      lastError = error;
    } catch (error) {
      const transient = error?.code === "ETIMEDOUT" || error?.name === "AbortError" || error?.message?.includes("fetch failed");
      if (!transient || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      structuredLogger.warn(`${operation} retrying after transient error`, { url, attempt: attempt + 1, error: error?.message ?? String(error) });
      await sleep(RETRY_DELAYS_MS[attempt]);
      lastError = error;
    }
  }
  throw lastError ?? new Error(`Failed ${operation}`);
}

export async function createWebhookCaptureSession(baseUrl, logger = console) {
  const response = await requestWithRetry(baseUrl, { method: "POST" }, logger, "createWebhookCaptureSession");
  const payload = await response.json();
  if (!payload?.capture_id || !payload?.update_url) {
    throw new Error("Invalid capture session response");
  }
  return { capture_id: payload.capture_id, update_url: payload.update_url };
}

export async function postWebhookCaptureUpdate(updateUrl, body, logger = console) {
  const response = await requestWithRetry(updateUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, logger, "postWebhookCaptureUpdate");
  return { statusCode: response.status };
}
