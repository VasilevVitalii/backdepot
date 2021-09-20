import { Database } from 'better-sqlite3'
import { FsStat } from '../fsstat'
import { Pk } from '../pk'
import * as core from './core'

export type TypeField = ('path' | 'file' | 'data' | 'fsstat_size' | 'fsstat_mtimeMs' | 'fsstat_ctimeMs' | 'fsstat_birthtimeMs')

export type TypeRow = {
    pk: Pk,
    fsstat: FsStat,
    data: string | undefined
}

export class TableData {
    readonly db: Database
    readonly table_name: string

    constructor(db: Database) {
        this.db = db
        this.table_name = 'data'
    }

    select (fields: TypeField[], filter: ({field: TypeField, value: string | number})[] | undefined, callback: (error: Error | undefined, rows: TypeRow[]) => void): void  {
        core.orm_select(this.db, this.table_name, fields, filter, (error, rows) => {
            callback(error, rows.map(m => {
                return {
                    pk: new Pk(m['path'], m['file']),
                    fsstat: new FsStat(m['fsstat_mtimeMs'],m['fsstat_ctimeMs'],m['fsstat_birthtimeMs'],m['fsstat_size']),
                    data: m['data']
                } as TypeRow
            }))
        })
    }

    delete (filter_fields: TypeField[], filter_values: any[], callback: (error: Error | undefined) => void): void {
        core.orm_delete(this.db, this.table_name, filter_fields, filter_values, callback)
    }

    upsert (rows: TypeRow[], callback: (error: Error | undefined) => void): void {
        if (rows.length <= 0) {
            callback(undefined)
            return
        }
        const query = [
            `INSERT INTO "${this.table_name}" ("path", "file", "data", "fsstat_size", "fsstat_mtimeMs", "fsstat_ctimeMs", "fsstat_birthtimeMs")`,
            `VALUES (@path, @file, @data, @fsstat_size, @fsstat_mtimeMs, @fsstat_ctimeMs, @fsstat_birthtimeMs)`,
            `ON CONFLICT (path, file) DO`,
            `UPDATE SET`,
            `"data"=excluded.data,`,
            `"fsstat_birthtimeMs"=excluded.fsstat_birthtimeMs,`,
            `"fsstat_ctimeMs"=excluded.fsstat_ctimeMs,`,
            `"fsstat_mtimeMs"=excluded.fsstat_mtimeMs,`,
            `"fsstat_size"=excluded.fsstat_size,`,
            `"fsstat_birthtimeMs"=excluded.fsstat_birthtimeMs`
        ].join(' ')
        core.exec_prepared(this.db, query, rows.map(m => {
            return {
                path: m.pk.path,
                file: m.pk.file,
                data: m.data,
                fsstat_size: m.fsstat.size,
                fsstat_mtimeMs: m.fsstat.mtimeMs,
                fsstat_ctimeMs: m.fsstat.ctimeMs,
                fsstat_birthtimeMs: m.fsstat.birthtimeMs
            }
        }), callback)
    }
}