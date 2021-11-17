import { Database } from 'better-sqlite3'
import { FsStat } from '../fsstat'
import { Pk } from '../pk'
import * as core from './core'

export type TField = ('path' | 'file' | 'data' | 'fsstatSize' | 'fsstatMtimeMs' | 'fsstatCtimeMs' | 'fsstatBirthtimeMs')

export type TRow = {
    pk: Pk,
    fsstat: FsStat,
    data: string | undefined
}

export class TableData {
    readonly db: Database
    readonly tableName: string

    constructor(db: Database) {
        this.db = db
        this.tableName = 'Data'
    }

    select (fields: TField[], filter: ({field: TField, value: string | number})[] | undefined, callback: (error: Error | undefined, rows: TRow[]) => void): void  {
        core.OrmSelect(this.db, this.tableName, fields, filter, (error, rows) => {
            callback(error, rows.map(m => {
                const r: TRow = {
                    pk: new Pk(m['path'], m['file']),
                    fsstat: new FsStat(m['fsstatMtimeMs'],m['fsstatCtimeMs'],m['fsstatBirthtimeMs'],m['fsstatSize']),
                    data: m['data']
                }
                return r
            }))
        })
    }

    delete (filterFields: TField[], filterValues: any[], callback: (error: Error | undefined) => void): void {
        core.OrmDelete(this.db, this.tableName, filterFields, filterValues, callback)
    }

    upsert (rows: TRow[], callback: (error: Error | undefined) => void): void {
        if (rows.length <= 0) {
            callback(undefined)
            return
        }
        const query = [
            `INSERT INTO "${this.tableName}" ("path", "file", "data", "fsstatSize", "fsstatMtimeMs", "fsstatCtimeMs", "fsstatBirthtimeMs")`,
            `VALUES (@path, @file, @data, @fsstatSize, @fsstatMtimeMs, @fsstatCtimeMs, @fsstatBirthtimeMs)`,
            `ON CONFLICT (path, file) DO`,
            `UPDATE SET`,
            `"data"=excluded.data,`,
            `"fsstatBirthtimeMs"=excluded.fsstatBirthtimeMs,`,
            `"fsstatCtimeMs"=excluded.fsstatCtimeMs,`,
            `"fsstatMtimeMs"=excluded.fsstatMtimeMs,`,
            `"fsstatSize"=excluded.fsstatSize,`,
            `"fsstatBirthtimeMs"=excluded.fsstatBirthtimeMs`
        ].join(' ')
        core.ExecPrepared(this.db, query, rows.map(m => {
            return {
                path: m.pk.path,
                file: m.pk.file,
                data: m.data,
                fsstatSize: m.fsstat.size,
                fsstatMtimeMs: m.fsstat.mtimeMs,
                fsstatCtimeMs: m.fsstat.ctimeMs,
                fsstatBirthtimeMs: m.fsstat.birthtimeMs
            }
        }), callback)
    }
}