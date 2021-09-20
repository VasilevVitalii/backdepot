import { Database } from 'better-sqlite3'
import * as core from './core'

export type TypeField = ('prop' | 'value')

export type TypeRow = {
    prop: string,
    value: string
}

export class TableData {
    readonly db: Database
    readonly table_name: string

    constructor(db: Database) {
        this.db = db
        this.table_name = 'eav_string'
    }

    select (fields: TypeField[], filter: ({field: TypeField, value: string})[], callback: (error: Error | undefined, rows: TypeRow[]) => void): void  {
        core.orm_select(this.db, this.table_name, fields, filter, (error, rows) => {
            callback(error, rows.map(m => {
                return {
                    prop: m['prop'],
                    value: m['value']
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
            `INSERT INTO "${this.table_name}" ("prop", "value")`,
            `VALUES (@prop, @value)`,
            `ON CONFLICT (prop) DO`,
            `UPDATE SET`,
            `"value"=excluded.value`,
        ].join(' ')
        core.exec_prepared(this.db, query, rows.map(m => {
            return {
                prop: m.prop,
                value: m.value
            }
        }), callback)
    }
}