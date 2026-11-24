declare module "wa-sqlite/dist/wa-sqlite-async.mjs" {
  export default function SQLiteAsyncESMFactory(config?: any): Promise<any>;
}

declare module "wa-sqlite" {
  export function Factory(module: any): any;
  export const SQLITE_OK: number;
  export const SQLITE_ROW: number;
  export const SQLITE_DONE: number;
  export const SQLITE_OPEN_READWRITE: number;
  export const SQLITE_OPEN_CREATE: number;
  export const SQLITE_OPEN_URI: number;
}

declare module "wa-sqlite/src/examples/IDBBatchAtomicVFS.js" {
  export class IDBBatchAtomicVFS {
    name: string;
    constructor(idbDatabaseName?: string, options?: any);
    close(): Promise<void>;
  }
}
