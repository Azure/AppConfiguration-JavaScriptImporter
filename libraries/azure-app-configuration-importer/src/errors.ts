// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ErrorObject } from "ajv";

/**
 * Custom error type used during input validation
 */
export class ArgumentError extends Error {
  constructor(message: string) {
    super();

    this.message = message;
  }
}

/**
 * Custom error type used during configuration file parsing
 */
export class ParseError extends Error {
  public message: string;

  constructor(message: string) {
    super();

    this.message = message;
  }
}

/**
 * Custom error type used for set configuration timeout error
 */
export class OperationTimeoutError extends Error {
  constructor() {
    super();
    this.message = "The operation failed to complete within the specified time limit.";
  }
}

/**
 * Custom error type used when null arguments are passed
 */
export class ArgumentNullError extends Error {}

export interface AjvError {
  schemaPath: string;
  message: string;
}

export class AjvValidationError extends Error {
  public errors: AjvError[];

  constructor(validationErrors: ErrorObject[]) {
    super("AJV validation errors occurred.");
    this.errors = this.parseAjvErrors(validationErrors);
  }

  private parseAjvErrors(validationErrors: ErrorObject[]): AjvError[] {
    return validationErrors.map(error => ({
      schemaPath: error.schemaPath,
      message: error.message || ""
    }));
  }

  public getFriendlyMessage(): string {
    return this.errors.map(error => {
      const property = error.schemaPath ? `Property '${error.schemaPath}'` : "A property";
      return `${property} ${error.message}`;
    }).join(", ");
  }
}