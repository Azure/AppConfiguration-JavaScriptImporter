import { FeatureFlagValue as FeatureFlagValueV1 } from "@azure/app-configuration";
import { ClientFilter } from "./models";

export interface FeatureFlagValue extends FeatureFlagValueV1 {
    id: string;
    description?: string;
    enabled: boolean;
    conditions: {
        clientFilters: ClientFilter[];
        requirement_type?: RequirementType
    };
    displayName?: string;
    allocation?: Allocation;
    variants?: Variant[];
    telemetry?: {
        enabled?: boolean;
    };
}

export enum RequirementType {
    Any = "Any",
    All = "All"
}

export enum StatusOverride {
    None = "None",
    Enabled =  "Enabled",
    Disabled = "Disabled"
}

export interface Allocation {
    user?: User [];
    group?: Group[];
    default_when_enabled?: string;
    default_when_disabled?: string;
    percentile?: Percentile[];
    seed?: string;
}

export interface User {
    variant: string;
    users: string[]
}

export interface Group {
    variant: string;
    groups: string[]
}

export interface Percentile {
    variant: string;
    from: string;
    to: string;
}

export interface Variant {
    name: string;
    configuration_value?: string | number | object | [] | boolean;
    status_override?: StatusOverride;
}

export type FeatureFlagKeywords = {
    feature_management: string;
    enabled_for: string;
    requirement_type: string;
    feature_flags: string;
    default_when_enabled: string;
    default_when_disabled: string;
    status_override: string;
    client_filters: string;
    display_name: string;
    configuration_value: string;
};

const PASCAL: FeatureFlagKeywords = {
  feature_management: "FeatureManagement",
  enabled_for: "EnabledFor",
  requirement_type: "RequirementType",
  feature_flags: "FeatureFlags",
  default_when_disabled: "DefaultWhenDisabled",
  default_when_enabled: "DefaultWhenEnabled",
  status_override: "StatusOverride",
  client_filters: "ClientFilters",
  display_name: "DisplayName",
  configuration_value: "ConfigurationValue"
};

const CAMEL: FeatureFlagKeywords = {
  feature_management: "featureManagement",
  enabled_for: "enabledFor",
  requirement_type: "requirementType",
  feature_flags: "featureFlags",
  default_when_disabled: "defaultwhenDisabled",
  default_when_enabled: "defaultWhenEnabled",
  status_override: "statusOverride",
  client_filters: "slientFilters",
  display_name: "displayName",
  configuration_value: "configurationValue"
};

const UNDERSCORE: FeatureFlagKeywords = {
  feature_management: "feature_management",
  enabled_for: "enabled_for",
  requirement_type: "requirement_type",
  feature_flags: "feature_flags",
  default_when_disabled: "default_when_disabled",
  default_when_enabled: "default_when_enabled",
  status_override: "status_override",
  client_filters: "client_filters",
  display_name: "display_name",
  configuration_value: "configuration_value"
};

const HYPHEN: FeatureFlagKeywords = {
  feature_management: "feature-management",
  enabled_for: "enabled-for",
  requirement_type: "requirement-type",
  feature_flags: "feature-flags",
  default_when_disabled: "default-when-disabled",
  default_when_enabled: "default-when-enabled",
  status_override: "status-override",
  client_filters: "client-filters",
  display_name: "display-name",
  configuration_value: "configuration-value"
};

export const AllKeyWordCases = [PASCAL, CAMEL, UNDERSCORE, HYPHEN];