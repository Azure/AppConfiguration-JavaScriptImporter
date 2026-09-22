import { RequirementType, StatusOverride } from "./featureFlag";

export const MsFeatureFlagValueSchema = {
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
          minItems: 0,
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
    display_name: { type: "string", nullable: true },
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
        enabled: { type: "boolean", nullable: true },
        metadata: { type: "object", nullable: true }
      }
    }
  },
  required: ["id"]
};

// Enhanced feature flag shape (service/FeatureFlagParam form): camelCase `name`/`filters`, shared by the FFSet and default-profile converters.
export const MsFeatureFlagEnhancedValueSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    label: { type: "string" },
    enabled: { type: "boolean" },
    description: { type: "string" },
    conditions: {
      type: "object",
      additionalProperties: false,
      properties: {
        requirement_type: { type: "string" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              parameters: { type: "object" }
            },
            required: ["name"]
          }
        }
      }
    },
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          configuration_value: { type: ["string", "number", "object", "boolean", "array", "null"] },
          status_override: { type: "string" }
        },
        required: ["name"]
      }
    },
    allocation: {
      type: "object",
      properties: {
        user: {
          type: "array",
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
        percentile: {
          type: "array",
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
        default_when_enabled: { type: "string" },
        default_when_disabled: { type: "string" },
        seed: { type: "string" }
      }
    },
    telemetry: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        metadata: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      },
      required: ["enabled"]
    },
    tags: {
      type: "object",
      additionalProperties: { type: "string" }
    }
  },
  required: ["name", "enabled"]
};