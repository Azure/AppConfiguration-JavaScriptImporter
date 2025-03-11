// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert } from "chai";
import { areTagsEqual, isJsonContentType, isConfigSettingEqual } from "../src/internal/utils";
import { ConfigurationSetting, FeatureFlagValue, SetConfigurationSettingParam } from "@azure/app-configuration";
import { MsFeatureFlagValue } from "../src/featureFlag";

describe("Test the utility methods", () => {
  it("Determine the content type is json contentType", async () => {
    assert.isTrue(isJsonContentType("application/json"));
    assert.isTrue(isJsonContentType("application/activity+json"));
    assert.isTrue(isJsonContentType("application/vnd.foobar+json;charset=utf-8"));
  });

  it("Determine the content type is not json contentType", async () => {
    assert.isFalse(isJsonContentType(undefined));
    assert.isFalse(isJsonContentType(""));
    assert.isFalse(isJsonContentType(" "));
    assert.isFalse(isJsonContentType("json"));
    assert.isFalse(isJsonContentType("application/"));
    assert.isFalse(isJsonContentType("application/test"));
    assert.isFalse(isJsonContentType("+"));
    assert.isFalse(isJsonContentType("vnd.foobar+json;charset=utf-8"));
    assert.isFalse(isJsonContentType("someteststring"));
    assert.isFalse(isJsonContentType("application/json+"));
    assert.isFalse(isJsonContentType("application/json+test"));
  });

  it("Determine if Tags with different values are not equal", async()=> {
    assert.isFalse(areTagsEqual({tag1: "value1", tag2: "value2"}, {}));
    assert.isFalse(areTagsEqual({}, {tag1: "value1", tag2: "value2"}));
    assert.isFalse(areTagsEqual(undefined, {tag1: "value1", tag2: "value2"}));
    assert.isFalse(areTagsEqual({tag1: "value1"}, {tag1: "value1", tag2: "value2"}));
    assert.isFalse(areTagsEqual({tag1: "value1", tag2: "value2"}, {tag1: "value1", tag3: "value2"}));
    assert.isFalse(areTagsEqual({tag1: "value1", tag2: "value2"}, {tag1: "value1", tag2: "value3"}));
  });

  it("Determine if Tags with similar values are equal", async()=> {
    assert.isTrue(areTagsEqual({tag1: "value1", tag2: "value2"}, {tag1: "value1", tag2: "value2"}));
    assert.isTrue(areTagsEqual({}, undefined));
    assert.isTrue(areTagsEqual({tag1: "value1"}, {tag1: "value1"}));
    assert.isTrue(areTagsEqual({}, {}));
  });

  it("Determine if key-values with different values are not equal", async()=> {
    const testKeyValue1: SetConfigurationSettingParam = {
      key: "key1", 
      value: "value1", 
      label: "dev", 
      contentType:"application/json",
      tags:{tag1: "tag1"}
    };
    const testKeyValue2: ConfigurationSetting = {
      key: "key1", 
      value: "value2", 
      label: "dev", 
      contentType:"application/json",
      tags:{tag1: "tag1"},
      isReadOnly:  false
    };
    const testKeyValue3: SetConfigurationSettingParam = {
      key: "key2", 
      value: "value1", 
      label: "prod", 
      contentType:"application/json",
      tags:{tag1: "tag1"}
    };
    const testKeyValue4: ConfigurationSetting = {
      key: "key2", 
      value: "value1", 
      label: "prod", 
      contentType:"application/json",
      tags:{tag1: "tag2"},
      isReadOnly: false
    };
    const testKeyValue5: SetConfigurationSettingParam = {
      key: "key2", 
      value: "value1", 
      label: "prod", 
      contentType:"application/json",
      tags:{tag1: "tag1"}
    };
    const testKeyValue6: ConfigurationSetting = {
      key: "key2", 
      value: "value1", 
      label: "prod", 
      contentType:"application/json",
      tags:{tag1: "tag2"},
      isReadOnly: false
    };

    const testKeyValue7: SetConfigurationSettingParam = {
      key: "FeatureA", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature\",\"enabled\":true,\"conditions\":{\"client_filters\":[]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };

    const testKeyValue8: ConfigurationSetting = {
      key: "FeatureB", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature updated description\",\"enabled\":true,\"conditions\":{\"client_filters\":[]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: false
    };

    const testKeyValue9: SetConfigurationSettingParam = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature updated description\",\"enabled\":true,\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"50\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };
    const testKeyValue10: ConfigurationSetting = {
      key: "FeatureY", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature updated description\",\"enabled\":true,\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"60\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: false
    };

    assert.isFalse(isConfigSettingEqual(testKeyValue1, testKeyValue2));
    assert.isFalse(isConfigSettingEqual(testKeyValue3, testKeyValue4));
    assert.isFalse(isConfigSettingEqual(testKeyValue5, testKeyValue6));
    assert.isFalse(isConfigSettingEqual(testKeyValue7, testKeyValue8));
    assert.isFalse(isConfigSettingEqual(testKeyValue9, testKeyValue10));
  });

  it("Determine if key-values with similar values are equal", async()=>{
    const testKeyValue1: SetConfigurationSettingParam = {
      key: "key1", 
      value: "value1", 
      label: "dev", 
      contentType:"application/json"
    };

    const testKeyValue2: ConfigurationSetting = {
      key: "key1", 
      value: "value1", 
      label: "dev", 
      contentType:"application/json",
      isReadOnly: false
    };

    const testKeyValue3: SetConfigurationSettingParam = {
      key: "key2", 
      value: "", 
      label: "", 
      contentType:"application/json",
      tags:{tag1: "tag1"}
    };
    const testKeyValue4: ConfigurationSetting = {
      key: "key2", 
      value: "", 
      label: "", 
      contentType:"application/json",
      tags:{tag1: "tag1"},
      isReadOnly: false
    };
    const testKeyValue5: SetConfigurationSettingParam = {
      key: "key3", 
      value: "value1", 
      label: "prod", 
      tags:{tag1: "tag1"}
    };
    const testKeyValue6: ConfigurationSetting = {
      key: "key3", 
      value: "value1", 
      label: "prod", 
      tags:{tag1: "tag1"},
      isReadOnly: false
    };

    assert.isTrue(isConfigSettingEqual(testKeyValue1, testKeyValue2));
    assert.isTrue(isConfigSettingEqual(testKeyValue3, testKeyValue4));
    assert.isTrue(isConfigSettingEqual(testKeyValue5, testKeyValue6));
  });

  it("Determine if feature flag values with same values are equal", async()=> {
    const testKeyValue1: SetConfigurationSettingParam = {
      key: "FeatureA", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature\",\"enabled\":true,\"conditions\":{\"client_filters\":[]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };

    const testKeyValue2: ConfigurationSetting = {
      key: "FeatureA", 
      value: "{\"id\":\"Beta\",\"enabled\":true,\"description\":\"Beta feature\",\"conditions\":{}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };

    const testKeyValue3: SetConfigurationSettingParam = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature updated description\",\"enabled\":true,\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"50\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };
    const testKeyValue4: ConfigurationSetting = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"enabled\":true,\"description\":\"Beta feature updated description\",\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"50\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };

    const testKeyValue5: SetConfigurationSettingParam<FeatureFlagValue> = {
      key: "FeatureX", 
      label: "test", 
      value: {
        id: "Beta",
        description: "Beta feature updated description",
        enabled: true,
        conditions:{
          clientFilters:[
            {
              name: "Microsoft.TimeWindow",
              parameters: {
                "End": "Wed, 06 Sep 2023 21:00:00 GMT"
              }
            }
          ]
        }
      },
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };

    const testKeyValue6: ConfigurationSetting = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"enabled\":true,\"description\":\"Beta feature updated description\",\"conditions\":{\"client_filters\":[{\"name\": \"Microsoft.TimeWindow\",\"parameters\": {\"End\": \"Wed, 06 Sep 2023 21:00:00 GMT\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };

    const testKeyValue7: SetConfigurationSettingParam<MsFeatureFlagValue> = {
      key: "FeatureX",
      label: "test",
      value: {
        id: "time001",
        enabled: true,
        description: "",
        conditions: {
          clientFilters: []
        },
        allocation: {
          percentile: [
            {
              variant: "Off",
              from: 0,
              to: 23
            },
            {
              variant: "On",
              from: 23,
              to: 100
            }
          ],
          group: [
            {
              variant: "On",
              groups: [
                "m1"
              ]
            },
            {
              variant: "Off",
              groups: [
                "m2",
                "m3"
              ]
            }
          ],
          user: [
            {
              variant: "Off",
              users: [
                "user1",
                "user3"
              ]
            },
            {
              variant: "On",
              users: [
                "user2"
              ]
            }
          ],
          seed: "bcngrfgnfgn",
          default_when_enabled: "On",
          default_when_disabled: "On"
        },
        variants: [
          {
            name: "Off",
            configuration_value: false
          },
          {
            name: "On",
            configuration_value: true
          }
        ]
      },
      contentType: "application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags: {tag1: "tag1"}
    };
 
    const testKeyValue8: ConfigurationSetting = {
      key: "FeatureX",
      label: "test",
      value: "{\"id\":\"time001\",\"enabled\":true,\"description\":\"\",\"conditions\":{\"client_filters\":[]},\"allocation\":{\"percentile\":[{\"variant\":\"Off\",\"from\":0,\"to\":23},{\"variant\":\"On\",\"from\":23,\"to\":100}],\"group\":[{\"variant\":\"On\",\"groups\":[\"m1\"]},{\"variant\":\"Off\",\"groups\":[\"m2\",\"m3\"]}],\"user\":[{\"variant\":\"Off\",\"users\":[\"user1\",\"user3\"]},{\"variant\":\"On\",\"users\":[\"user2\"]}],\"seed\":\"bcngrfgnfgn\",\"default_when_enabled\":\"On\",\"default_when_disabled\":\"On\"},\"variants\":[{\"name\":\"Off\",\"configuration_value\":false},{\"name\":\"On\",\"configuration_value\":true}]}",
      contentType: "application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags: {tag1: "tag1"},
      isReadOnly: true
    };


    assert.isTrue(isConfigSettingEqual(testKeyValue1, testKeyValue2));
    assert.isTrue(isConfigSettingEqual(testKeyValue3, testKeyValue4));
    assert.isTrue(isConfigSettingEqual(testKeyValue5, testKeyValue6));
    assert.isTrue(isConfigSettingEqual(testKeyValue7, testKeyValue8));
  });

  it("Determine if feature flag values with different values are not equal", async()=> {
    const testKeyValue1: SetConfigurationSettingParam = {
      key: "FeatureA", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature\",\"enabled\":true,\"conditions\":{\"client_filters\":[]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };

    const testKeyValue2: ConfigurationSetting = {
      key: "FeatureA", 
      value: "{\"id\":\"Beta\",\"enabled\":true,\"description\":\"Beta feature description\",\"conditions\":{}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };

    const testKeyValue3: SetConfigurationSettingParam = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"description\":\"Beta feature updated description\",\"enabled\":true,\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"40\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };
    const testKeyValue4: ConfigurationSetting = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"enabled\":true,\"description\":\"Beta feature updated description\",\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"50\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };

    const testKeyValue5: SetConfigurationSettingParam<FeatureFlagValue> = {
      key: "FeatureX", 
      value: {
        id: "Dev",
        description: "Beta feature updated description",
        enabled: true,
        conditions: {
          clientFilters: [
            {name: "Percentage", parameters: {"PercentageFilterSetting": "40"}}
          ]
        }
      },
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };

    const testKeyValue6: ConfigurationSetting = {
      key: "FeatureX", 
      value: "{\"id\":\"Dev\",\"enabled\":true,\"description\":\"Beta feature updated description\",\"conditions\":{\"client_filters\":[{\"name\": \"Percentage\",\"parameters\": {\"PercentageFilterSetting\": \"50\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };
    const testKeyValue7: SetConfigurationSettingParam<FeatureFlagValue> = {
      key: "FeatureX", 
      label: "test", 
      value: {
        id: "Beta",
        description: "Beta feature updated description",
        enabled: true,
        conditions:{
          clientFilters:[
            {
              name: "Microsoft.TimeWindow",
              parameters: {
                "End": "Thur, 08 Sep 2023 21:00:00 GMT"
              }
            }
          ]
        }
      },
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"}
    };

    const testKeyValue8: ConfigurationSetting = {
      key: "FeatureX", 
      value: "{\"id\":\"Beta\",\"enabled\":true,\"description\":\"Beta feature updated description\",\"conditions\":{\"client_filters\":[{\"name\": \"Microsoft.TimeWindow\",\"parameters\": {\"End\": \"Wed, 06 Sep 2023 21:00:00 GMT\"}}]}}", 
      label: "test", 
      contentType:"application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags:{tag1: "tag1"},
      isReadOnly: true
    };

    const testKeyValue9: SetConfigurationSettingParam<MsFeatureFlagValue> = {
      key: "FeatureX",
      label: "test",
      value: {
        id: "time001",
        enabled: true,
        description: "",
        conditions: {
          clientFilters: []
        },
        allocation: {
          percentile: [
            {
              variant: "Off",
              from: 0,
              to: 23
            },
            {
              variant: "On",
              from: 23,
              to: 100
            }
          ],
          group: [
            {
              variant: "On",
              groups: [
                "m1"
              ]
            },
            {
              variant: "Off",
              groups: [
                "m2",
                "m3"
              ]
            }
          ],
          user: [
            {
              variant: "Off",
              users: [
                "user1",
                "user3"
              ]
            },
            {
              variant: "On",
              users: [
                "user2"
              ]
            }
          ],
          seed: "bcngrfgnfgn",
          default_when_enabled: "On",
          default_when_disabled: "On"
        },
        variants: [
          {
            name: "Off",
            configuration_value: false
          },
          {
            name: "On",
            configuration_value: true
          }
        ]
      },
      contentType: "application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags: { tag1: "tag1" }
    };

    const testKeyValue10: ConfigurationSetting = {
      key: "FeatureX",
      label: "test",
      value: "{\"id\":\"time001\",\"enabled\":true,\"description\":\"\",\"conditions\":{\"client_filters\":[]},\"allocation\":{\"percentile\":[{\"variant\":\"Off\",\"from\":0,\"to\":23},{\"variant\":\"On\",\"from\":23,\"to\":100}],\"group\":[{\"variant\":\"On\",\"groups\":[\"m1\"]},{\"variant\":\"Off\",\"groups\":[\"m2\",\"m3\"]}],\"user\":[{\"variant\":\"Off\",\"users\":[\"user1\",\"user3\"]},{\"variant\":\"On\",\"users\":[\"user2\"]}],\"seed\":\"bcngrfgnfgn\",\"default_when_enabled\":\"On\",\"default_when_disabled\":\"On\"},\"variants\":[{\"name\":\"Off\",\"configuration_value\":false},{\"name\":\"On\",\"configuration_value\":true,\"status_override\":\"None\"}]}",
      contentType: "application/vnd.microsoft.appconfig.ff+json;charset=utf-8",
      tags: {},
      isReadOnly: true
    };

    assert.isFalse(isConfigSettingEqual(testKeyValue1, testKeyValue2));
    assert.isFalse(isConfigSettingEqual(testKeyValue3, testKeyValue4));
    assert.isFalse(isConfigSettingEqual(testKeyValue5, testKeyValue6));
    assert.isFalse(isConfigSettingEqual(testKeyValue7, testKeyValue8));
    assert.isFalse(isConfigSettingEqual(testKeyValue9, testKeyValue10));
  });
});
