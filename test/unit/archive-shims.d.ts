// SPDX-License-Identifier: MIT
// Minimal ambient declarations for the pinned archive-packaging libraries
// that ship without bundled TypeScript types. We use a narrow surface that
// matches exactly what the release-archive tests need — no exported API
// beyond the functions, streams, and entry shapes the harness exercises.

declare module "tar-stream" {
  interface PackStreamOptions {
    readonly freemem?: number;
  }
  interface PackEntryHeaders {
    name: string;
    size?: number;
    mode?: number;
    mtime?: Date;
    type?: "file" | "link" | "symlink" | "directory" | "block-device" | "character-device" | "fifo" | "contiguous-file";
    linkname?: string;
    uid?: number;
    gid?: number;
    uname?: string;
    gname?: string;
    devmajor?: number;
    devminor?: number;
    pax?: Record<string, string> | null;
  }
  interface PackEntry {
    write(chunk: Buffer | string): boolean;
    end(): void;
    on(event: "finish", listener: () => void): this;
    once(event: "finish", listener: () => void): this;
  }
  interface Pack {
    entry(
      headers: PackEntryHeaders,
      buffer: Buffer | string,
      callback?: (error: Error | null) => void,
    ): PackEntry;
    finalize(): void;
  }
  interface ExtractEntryHeaders {
    name: string;
    type?: string;
    size?: number;
    mode?: number;
    mtime?: Date;
    linkname?: string;
    uid?: number;
    gid?: number;
    uname?: string;
    gname?: string;
    pax?: Record<string, string> | null;
  }
  interface ExtractEntry extends NodeJS.ReadableStream {
    header: ExtractEntryHeaders;
  }
  interface Extract extends NodeJS.ReadableStream {}
  function pack(options?: PackStreamOptions): Pack;
  function extract(): Extract;
  const _default: { pack: typeof pack; extract: typeof extract };
  export default _default;
  export { pack, extract };
}

declare module "yazl" {
  interface AddBufferOptions {
    compress?: boolean;
    compressionLevel?: number;
    forceDosTimestamp?: boolean;
    mode?: number;
    mtime?: Date;
    comment?: string;
  }
  class ZipFile {
    addBuffer(buffer: Buffer, metadataPath: string, options?: AddBufferOptions): void;
    end(): void;
    readonly outputStream: NodeJS.ReadableStream;
  }
  interface YazlModule {
    ZipFile: typeof ZipFile;
  }
  const _default: YazlModule;
  export default _default;
}

declare module "yauzl" {
  interface Entry {
    fileName: string;
    compressedSize: number;
    uncompressedSize: number;
    extraFields: Buffer;
    comment: string;
    generalPurposeBitFlag: number;
    externalFileAttributes: number;
    versionMadeBy: number;
    versionNeededToExtract: number;
  }
  interface ZipFile extends NodeJS.EventEmitter {
    readEntry(): void;
    openReadStream(entry: Entry, callback: (error: Error | null, stream: NodeJS.ReadableStream | null) => void): void;
  }
  interface FromBufferOptions {
    lazyEntries?: boolean;
    autoClose?: boolean;
  }
  type OpenCallback = (error: Error | null, zip: ZipFile | null) => void;
  function open(path: string, options: FromBufferOptions, callback: OpenCallback): void;
  function fromBuffer(buffer: Buffer, options: FromBufferOptions, callback: OpenCallback): void;
}
