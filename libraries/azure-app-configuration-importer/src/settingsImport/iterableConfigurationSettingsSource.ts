// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PagedAsyncIterableIterator, PageSettings } from "@azure/core-paging";
import { ConfigurationSettingsSource } from "./configurationSettingsSource";
import { 
  ConfigurationSetting, 
  SetConfigurationSettingParam, 
  FeatureFlagValue,
  SecretReferenceValue,
  ListConfigurationSettingsOptions, 
  ListConfigurationSettingPage, 
  featureFlagContentType,
  featureFlagPrefix,
  secretReferenceContentType} from "@azure/app-configuration";
import { IterableSourceOptions } from "../importOptions";
import { ArgumentError } from "../errors";

export class IterableConfigurationSettingsSource implements ConfigurationSettingsSource {
  public FilterOptions: ListConfigurationSettingsOptions = {};

  private data: PagedAsyncIterableIterator<ConfigurationSetting<string>, ListConfigurationSettingPage, PageSettings>;
  private options: IterableSourceOptions;

  constructor(options: IterableSourceOptions) {
    this.data = options.data;
    this.options = options;
    
    this.FilterOptions = {
      keyFilter: options.prefix ? options.prefix + "*" : undefined,
      labelFilter: options.label ? options.label : "\0"
    };
  }
   
  /**
     * @inheritdoc
     */
  public async GetConfigurationSettings(): Promise<SetConfigurationSettingParam<string | FeatureFlagValue | SecretReferenceValue>[]> {
    const result: SetConfigurationSettingParam[] = [];

    for await (const configuration of this.data) {
      const isFeatureFlag: boolean = configuration.key.startsWith(featureFlagPrefix) && configuration.contentType == featureFlagContentType;
      const isKeyVaultReference: boolean = configuration.contentType == secretReferenceContentType;
      const contentType: string | undefined = isFeatureFlag || isKeyVaultReference ?
        configuration.contentType :
        this.options.contentType || configuration.contentType;

      let generatedKey: string = configuration.key;
      
      if (this.options.prefix || this.options.trimPrefix) {
        if (isFeatureFlag) {
          generatedKey = generatedKey.substring(featureFlagPrefix.length);
        }

        if (this.options.trimPrefix && generatedKey.startsWith(this.options.trimPrefix)) {
          generatedKey = generatedKey.substring(this.options.trimPrefix.length);
        }

        if (this.options.prefix) {
          generatedKey = this.options.prefix + generatedKey;
        }

        if(isFeatureFlag) {
          generatedKey = featureFlagPrefix + generatedKey;
        }
      }
      
      if (generatedKey === "." || generatedKey === ".." || generatedKey.indexOf("%") > -1) {
        throw new ArgumentError("Key cannot be a '.' or '..', or contain the '%' character.");
      }
    
      if (this.options.skipFeatureFlags && isFeatureFlag) {
        continue;
      }

      result.push({
        key: generatedKey,
        label: this.options.label || configuration.label,
        value: configuration.value,
        contentType: contentType,
        tags: configuration.tags
      });
    }

    return result;
  }
}