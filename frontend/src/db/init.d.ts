declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ModuleFactory(config?: { locateFile?: (url: string) => string }): Promise<any>
  export = ModuleFactory
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
  export class OriginPrivateFileSystemVFS {
    constructor()
    readonly name: string
    close(): Promise<void>
  }
}
