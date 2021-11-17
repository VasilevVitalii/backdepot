import { Database } from 'better-sqlite3'
import * as core from './core'
import { Pk } from '../pk'

export type TField = ('path' | 'file' | 'prop' | 'value')

export type TRow = {
    pk: Pk,
    prop: string,
    level: string,
    value: number
}

export class TableData {
    readonly db: Database
    readonly tableName: string

    constructor(db: Database) {
        this.db = db
        this.tableName = 'DataIndexNumber'
    }

    select (fields: TField[], filter: ({field: TField, value: string | number})[], callback: (error: Error | undefined, rows: TRow[]) => void): void  {
        core.OrmSelect(this.db, this.tableName, fields, filter, (error, rows) => {
            callback(error, rows.map(m => {
                const r: TRow = {
                    pk: new Pk(m['path'], m['file']),
                    prop: m['prop'],
                    level: '',
                    value: m['value']
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
            `INSERT INTO "${this.tableName}" ("path", "file", "prop", "level", "value")`,
            `VALUES (@path, @file, @prop, @level, @value)`,
            `ON CONFLICT ("path", "file", "prop", "level") DO`,
            `UPDATE SET`,
            `"value"=excluded.value`,
        ].join(' ')
        core.ExecPrepared(this.db, query, rows.map(m => {
            return {
                path: m.pk.path,
                file: m.pk.file,
                prop: m.prop,
                level: m.level,
                value: m.value
            }
        }), callback)
    }
}