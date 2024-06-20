// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @internal */
export function toWebStream(source:  NodeJS.ReadableStream | ReadableStream<Uint8Array>): ReadableStream<Uint8Array> { 
  if (isWebReadableStream(source)) {
    return  source as ReadableStream<Uint8Array>;
  }

  throw new Error ("Unexpected Node stream in browser environment");
}

function isWebReadableStream(stream: unknown): boolean {
  return Boolean(stream && 
    typeof stream === "object" && 
    typeof (stream as ReadableStream).getReader === "function" &&
    typeof (stream as ReadableStream).tee === "function");
}
