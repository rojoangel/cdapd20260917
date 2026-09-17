import { defineConfig } from "@adobe/aio-commerce-lib-app/config";

export default defineConfig({
  businessConfig: {
    schema: [
      {
        default: "https://aisenseapi.com/services/v1/webhook_capture",
        description: "Base URL for the external welcome/capture service.",
        label: "Welcome service base URL",
        name: "welcome_service_base_url",
        type: "url",
      },
    ],
  },
  eventing: {
    commerce: [
      {
        provider: {
          label: "Commerce Events Provider",
          description: "Handles native Commerce events for this app.",
        },
        events: [
          {
            name: "observer.customer_save_commit_after",
            label: "Customer Account Saved",
            description: "Triggered after a customer account is committed in Commerce.",
            fields: [{ name: "email" }, { name: "created_at" }, { name: "updated_at" }],
            runtimeActions: ["my-app/handle-customer-created"],
          },
        ],
      },
    ],
  },
  metadata: {
    id: "customer-welcome-notifier",
    displayName: "Customer Welcome Notifier",
    description: "Notifies an external welcome service, at a merchant-configurable base URL, when a genuinely new customer account is created.",
    version: "1.1.0",
  },
});
