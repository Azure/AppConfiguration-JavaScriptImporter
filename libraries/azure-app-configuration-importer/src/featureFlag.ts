import { ClientFilter } from "./models";
import { FeatureFlagValue as FeatureFlagValue1 } from "@azure/app-configuration";

export interface FeatureFlagValue extends FeatureFlagValue1 {
    id?: string;
    description?: string;
    enabled: boolean;
    conditions: {
        clientFilters: ClientFilter[];
        requirementType?: RequirementType
    };
    displayName?: string;
    allocation?: Allocation;
    variants?: Variant[];
    telemetry?: {
        enabled?: boolean;
        metadata?: object;
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
    from: number;
    to: number;
}

export interface Variant {
    name: string;
    configuration_value?: string | number | object | boolean;
    status_override?: StatusOverride;
}