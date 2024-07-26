# Azure App Configuration - JavaScript Importer File Source

The [Azure App Configuration](https://docs.microsoft.com/azure/azure-app-configuration/overview) Importer File Source for JavaScript enables developers to import their configuration settings from a file sources to Azure App Configuration service.

Key links:

- [Source code](https://github.com/Azure/AppConfiguration-JavaScriptImporter/tree/main/libraries/azure-app-configuration-importer-file-source)
- [Package (NPM)](https://www.npmjs.com/package/@azure/app-configuration-importer-file-source)
- [Product documentation](https://docs.microsoft.com/azure/azure-app-configuration/)
- [Examples](https://github.com/Azure/AppConfiguration-JavaScriptImporter/tree/main/libraries/azure-app-configuration-importer-file-source/examples)

## Getting started

### Currently supported environments 
- [LTS versions of Node.js](https://github.com/nodejs/release#release-schedule)

### Prerequisites

- An [Azure Subscription](https://azure.microsoft.com)
- An [App Configuration](https://learn.microsoft.com/azure/azure-app-configuration/quickstart-azure-app-configuration-create?tabs=azure-portal) resource

### Install the package

```bash
npm i @azure/app-configuration-importer-file-source
```

### Use the API

```ts
   import { FileConfigurationSettingsSource, FileConfigurationSyncOptions } from "@azure/app-configuration-importer-file-source";
   import { AppConfigurationImporter } from "@azure/app-configuration-importer";

   const client = new AppConfigurationClient("<app-configuration-connection-string>");
   const appConfigurationImporterClient = new AppConfigurationImporter(client);

   // Import settings
   const result = await appConfigurationImporterClient.Import(new FileConfigurationSettingsSource({filePath:  path.join(__dirname, "..", "source/mylocalPath.json"), format: ConfigurationFormat.Json}));
```

## Examples

See code snippets under [examples/](./examples/) folder.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.