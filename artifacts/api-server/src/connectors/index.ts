import { MerakiConnector } from "./meraki";
import { FortinetConnector } from "./fortinet";
import type { BaseConnector } from "./base";
import type { Controller } from "@workspace/db";

export { MerakiConnector, FortinetConnector };
export type { BaseConnector };

/**
 * Factory: create the appropriate connector for a given Controller record.
 * Returns null if vendor is unsupported.
 */
export function createConnector(controller: Controller): BaseConnector | null {
  const apiKey = controller.apiKeyEncryptedOrPlaceholder ?? "placeholder";
  const baseUrl = controller.baseUrl;

  switch (controller.vendor) {
    case "meraki":
      return new MerakiConnector({
        apiKey,
        baseUrl,
        organizationId: controller.organizationIdOrTenant ?? "",
      });

    case "fortinet":
      return new FortinetConnector({
        apiKey,
        baseUrl,
        organizationIdOrTenant: controller.organizationIdOrTenant ?? undefined,
        managerType: controller.type === "firewall_manager" ? "fortimanager" : "fortigate",
      });

    default:
      return null;
  }
}
