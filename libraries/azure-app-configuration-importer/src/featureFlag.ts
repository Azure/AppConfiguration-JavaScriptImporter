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

enum RequirementType {
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