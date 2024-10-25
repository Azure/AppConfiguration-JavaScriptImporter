import { FeatureFlagValue, RequirementType, StatusOverride } from "./featureFlag";
import { JSONSchemaType } from "ajv";

export const featureFlagValueSchema: JSONSchemaType<FeatureFlagValue> = {
  type: "object",
  properties: {
    id: { type: "string" },
    description: { type: "string", nullable: true },
    enabled: { type: "boolean", nullable: true },
    conditions: {
      type: "object",
      nullable: true,
      properties: {
        client_filters: {
          type: "array",
          nullable: true,
          items: {
            type: "object",
            properties: {
              name: { type: "string"},
              parameters: { type: "object", nullable: true }
            },
            required: ["name"]
          }
        },
        requirement_type: {
          type: "string",
          nullable: true,
          enum: [RequirementType.All, RequirementType.Any] }
      }
    },
    displayName: { type: "string", nullable: true },
    allocation: {
      type: "object",
      nullable: true,
      properties: {
        user: {
          type: "array",
          nullable: true,
          items: {
            type: "object",
            properties: {
              variant: { type: "string" },
              users: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["variant", "users"]
          }
        },
        group: {
          type: "array",
          nullable: true,
          items: {
            type: "object",
            properties: {
              variant: { type: "string" },
              groups: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["variant", "groups"]
          }
        },
        default_when_enabled: { type: "string", nullable: true },
        default_when_disabled: { type: "string", nullable: true },
        percentile: {
          type: "array",
          nullable: true,
          items: {
            type: "object",
            properties: {
              variant: { type: "string" },
              from: { type: "number", minimum: 0, maximum: 100 },
              to: { type: "number", minimum: 0, maximum: 100 }
            },
            required: ["variant", "from", "to"]
          }
        },
        seed: { type: "string", nullable: true }
      }
    },
    variants: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          configuration_value: { 
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "object", additionalProperties: true },
              { type: "boolean"},
              { type: "array"},
              { type: "null"}
            ]} as any,
          status_override: {
            type: "string",
            nullable: true,
            enum: [StatusOverride.None, StatusOverride.Enabled, StatusOverride.Disabled]
          }
        },
        required: ["name"]
      }
    },
    telemetry: {
      type: "object",
      nullable: true,
      properties: {
        enabled: { type: "boolean", nullable: true }
      }
    }
  },
  required: ["id"]
};