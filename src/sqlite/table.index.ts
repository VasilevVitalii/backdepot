import { Database } from 'better-sqlite3'
import * as core from './core'

export type TField = ('prop' | 'type')

export type TRow = {
    prop: string,
    type: 'number' | 'string'
}

export class TableData {
    readonly db: Database
    readonly tableName: string

    constructor(db: Database) {
        this.db = db
        this.tableName = 'Index'
    }

    select (fields: TField[], filter: ({field: TField, value: string | number})[], callback: (error: Error | undefined, rows: TRow[]) => void): void  {
        core.OrmSelect(this.db, this.tableName, fields, filter, (error, rows) => {
            callback(error, rows.map(m => {
                return {
                    prop: m['prop'],
                    type: m['type']
                } as TRow
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
            `INSERT INTO "${this.tableName}" ("prop", "type")`,
            `VALUES (@prop, @type)`,
            `ON CONFLICT (prop) DO`,
            `UPDATE SET`,
            `"type"=excluded.type`,
        ].join(' ')
        core.ExecPrepared(this.db, query, rows.map(m => {
            return {
                prop: m.prop,
                type: m.type
            }
        }), callback)
    }
}