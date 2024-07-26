# Examples for Azure App Configuration Importer File Source

These examples show how to use the App Configuration Importer File Source in some common scenarios

| File Name                                                                    | Description                                                                                          |
| -----------------------------------------------------------------------------| ---------------------------------------------------------------------------------------------------- |
| [fileSourceExampleWithDefault.ts](./src/fileSourceExampleWithDefault.ts)     |  Demonstrates importing configuration settings from a file source with default file content profile  |
| [fileSourceExampleWithKVSet.ts](./src/fileSourceExampleWithKVSet.ts)         |  Demonstrates importing configuration settings from a file source with KVSet file content profile    |

## Prerequisites

The examples are compatible with [LTS version of Node.js](https://github.com/nodejs/release#release-schedule).

You'll need the following Azure resources to run the examples

- An [Azure subscription](https://azure.microsoft.com/free/)
- An [Azure App Configuration store](https://learn.microsoft.com/azure/azure-app-configuration/quickstart-azure-app-configuration-create?tabs=azure-portal)

Before running the samples in Node, they must be complied to JavaScript using the TypeScript complier. For more information on TypeScript,
see the [TypeScript documentation](https://www.typescriptlang.org/docs/home). Install the TypeScript compiler using:

```bash
    npm install -g typescript
```

## Setup & Run

To run the examples using the published version of the package:

1. Install the dependencies using `npm`:

    ```bash
        npm install
    ```
2. There are two ways to run the examples using the correct credentials:

    - Edit the file `sample.env`, adding the correct credentials to access your App Configuration. Then rename the file from `sample.env` to just `.env`. The examples will read the file automatically.

    - Alternatively, you can set the environment variable to the access keys to your App Configuration store. In this case, setting up the `.env` file is not required.

        ```bash
            npx cross-env APPCONFIG_CONNECTION_STRING="<appconfig connection string>"
        ```

3. Compile the examples

    ```bash
        npm run build
    ```

4. Run whichever example you like 

    ```bash
        node dist\fileSourceExampleWithDefault.js
    ```

5. Clean up any configuration settings that may have been imported to your store if you don't plan on using them.
