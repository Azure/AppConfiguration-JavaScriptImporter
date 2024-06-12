// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ConfigurationFormat, ConfigurationProfile } from "@azure/app-configuration-importer";
import { Tags } from "./Tags";
/**
 * Base options for configuration import
 *
 * @internal
 */
export type SourceOptions = {
    format: ConfigurationFormat;
    separator?: string;
    depth?: number;
    profile?: ConfigurationProfile;
    label?: string;
    skipFeatureFlags?: boolean;
    prefix?: string;
    contentType?: string;
    tags?: Tags;
}

export type FileSourceOptions = SourceOptions & { filePath: string; };
