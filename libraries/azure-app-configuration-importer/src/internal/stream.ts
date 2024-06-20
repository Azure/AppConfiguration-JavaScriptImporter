// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Readable } from "stream";

/** @internal */
export function toWebStream(source:  NodeJS.ReadableStream | ReadableStream<Uint8Array>): ReadableStream<Uint8Array> { 
  if (isNodeReadableStream(source)) {
    const stream  = source as NodeJS.ReadableStream;
    return Readable.toWeb(Readable.from(stream)) as ReadableStream<Uint8Array>;
  }

  return source as ReadableStream<Uint8Array>;
}

function isNodeReadableStream(stream: unknown): boolean {
  return Boolean(stream && typeof stream === "object" && typeof (stream as NodeJS.ReadableStream).pipe === "function");
}
