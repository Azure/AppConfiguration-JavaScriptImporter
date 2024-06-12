// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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
