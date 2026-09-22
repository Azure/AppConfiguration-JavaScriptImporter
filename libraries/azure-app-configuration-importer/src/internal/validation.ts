// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { SourceOptions } from "../options";
import { ConfigurationFormat, ConfigurationProfile, ImportMode } from "../enums";
import { ArgumentError, ArgumentNullError } from "../errors";
import { Constants } from "../internal/constants";
import { isJsonContentType } from "./utils";

/** @internal */
export function validateImportMode(importMode: ImportMode): void {
  if (importMode !== ImportMode.IgnoreMatch && importMode !== ImportMode.All) {
    throw new ArgumentError("Only options supported for Import Mode are 'All' and 'Ignore-Match'.");
  }
}

/** @internal*/
/**
 * Validate the ConfigurationSyncOptions argument, throw fatal error if options are not valid.
 *
 * @param options - ConfigurationSyncOptions to be validated.
 */
export function validateOptions(options: SourceOptions): void {
  if (!options) {
    throw new ArgumentNullError();
  }

  if (options.profile == ConfigurationProfile.KvSet || options.profile == ConfigurationProfile.FfSet) {
    const profileName = options.profile == ConfigurationProfile.KvSet ? "appconfig/kvset" : "appconfig/ffset";
    if (
      options.prefix ||
      options.separator ||
      options.label ||
      options.depth ||
      options.tags ||
      options.contentType
    ) {
      throw new ArgumentError(
        `The option label, prefix, depth, contentType, tags and separator are not supported when importing using '${profileName}' profile`
      );
    }

    if (options.format !== ConfigurationFormat.Json) {
      throw new ArgumentError(
        `Yaml and Properties formats are not supported for ${profileName} profile. Supported value is: Json`
      );
    }
  }

  if (options.depth && options.depth > 1 && !options.separator) {
    throw new ArgumentError(
      "Separator must be specified if Depth is default value or set a value lager than 1"
    );
  }

  if (options.separator && !Constants.Separators.includes(options.separator)) {
    throw new ArgumentError(`${options.separator} is not a supported separator.`);
  }

  if (!options.separator && !options.depth) {
    options.depth = 1;
  }

  if (options.format !== ConfigurationFormat.Json && isJsonContentType(options.contentType)) {
    throw new ArgumentError(`Failed to import '${ConfigurationFormat[options.format]}' data format with '${options.contentType}' content type. Please provide data in JSON format to match your content type.`);
  }
}
