import * as vvs from 'vv-shared'
import * as sqlite_driver from 'better-sqlite3'
import * as core from './core'
import { TableData as Table_Data } from './table.data'
import { TableData as Table_DataEavNumber } from './table.data_eav_number'
import { TableData as Table_DataEavString } from './table.data_eav_string'
import { TableData as Table_DataIndexNumber } from './table.data_index_number'
import { TableData as Table_DataIndexString } from './table.data_index_string'
import { TableData as Table_EavNumber } from './table.eav_number'
import { TableData as Table_EavString } from './table.eav_string'
import { TableData as Table_Index } from './table.index'
import { TypeRow as Row_DataEavString } from './table.data_eav_string'
import { TypeRow as Row_DataIndexNumber } from './table.data_index_number'
import { TypeRow as Row_DataIndexString } from './table.data_index_string'
import { TypeOptionsStateIndex } from '../index.env'
import { Pk } from '../pk'
import { to_number, to_string } from '../z'

export class Sqlite {
    readonly schemaver = 1

    readonly base: sqlite_driver.Database

    readonly orm: {
        data_eav_number: Table_DataEavNumber,
        data_eav_string: Table_DataEavString,
        data_index_number: Table_DataIndexNumber,
        data_index_string: Table_DataIndexString,
        data: Table_Data,
        eav_number: Table_EavNumber,
        eav_string: Table_EavString,
        index: Table_Index,
    }

    readonly indexes: TypeOptionsStateIndex[]

    constructor(full_file_name: string, indexes: TypeOptionsStateIndex[], callback_query: ((query: string) => void) | undefined ) {
        //TODO check constructor
        this.base = new sqlite_driver.default(
            full_file_name,
            {
                verbose: typeof callback_query === 'function'
                    ?
                    function(message) {
                        callback_query(`sqlite: ${message}`)
                    }
                    :
                    undefined
            }
        )
        this.indexes = indexes
        this.orm = {
            data_eav_number: new Table_DataEavNumber(this.base),
            data_eav_string: new Table_DataEavString(this.base),
            data_index_number: new Table_DataIndexNumber(this.base),
            data_index_string: new Table_DataIndexString(this.base),
            data: new Table_Data(this.base),
            eav_number: new Table_EavNumber(this.base),
            eav_string: new Table_EavString(this.base),
            index: new Table_Index(this.base)
        }
    }

    exec_core_prepared(query: string, params: any[], callback: (error: Error | undefined) => void) {
        core.exec_prepared(this.base, query, params, callback)
    }

    exec_core_plain(queries: string[], callback: (error: Error | undefined) => void) {
        core.exec_plain(this.base, queries, 0, callback)
    }

    exec_core_select (query: string, param: any | undefined, callback: (error: Error | undefined, rows: any[]) => void) {
        core.exec_select(this.base, query, param, callback)
    }

    exec_init(callback: (error: Error | undefined) => void): void {
        const queries1 = [
            //`PRAGMA journal_mode = WAL`,
            //`PRAGMA synchronous = NORMAL`,
            `CREATE TABLE IF NOT EXISTS "eav_string" ("prop" TEXT NOT NULL PRIMARY KEY, "value" TEXT)`,
            `CREATE TABLE IF NOT EXISTS "eav_number" ("prop" TEXT NOT NULL PRIMARY KEY, "value" INTEGER)`,
            `CREATE TABLE IF NOT EXISTS "index" ("prop" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL)`,
            `CREATE TABLE IF NOT EXISTS "data" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "data" TEXT, "fsstat_size" INTEGER, "fsstat_mtimeMs" INTEGER, "fsstat_ctimeMs" INTEGER, "fsstat_birthtimeMs" INTEGER, PRIMARY KEY("path", "file"))`,
            `CREATE TABLE IF NOT EXISTS "data_index_string" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "value" TEXT, PRIMARY KEY("path", "file", "prop"))`,
            `CREATE TABLE IF NOT EXISTS "data_index_number" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "value" INTEGER, PRIMARY KEY("path", "file", "prop"))`,
            `CREATE TABLE IF NOT EXISTS "data_eav_string" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "value" TEXT, PRIMARY KEY("path", "file", "prop"))`,
            `CREATE TABLE IF NOT EXISTS "data_eav_number" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "value" INTEGER, PRIMARY KEY("path", "file", "prop"))`,
            `INSERT INTO "eav_number"("prop", "value") SELECT 'schemaver', '${this.schemaver}' WHERE NOT EXISTS (SELECT 1 FROM "eav_number" WHERE "prop" = 'schemaver')`,
            `DELETE FROM "index"`
        ]
        const queries2 = [
            `DELETE FROM "data_index_number" WHERE "prop" NOT IN (SELECT "prop" FROM "index" WHERE "value" = 'number')`,
            `DELETE FROM "data_index_string" WHERE "prop" NOT IN (SELECT "prop" FROM "index" WHERE "value" = 'string')`,
            `DELETE FROM "data_index_string" WHERE ROWID IN (SELECT di.ROWID FROM "data_index_string" di LEFT JOIN "data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
            `DELETE FROM "data_index_number" WHERE ROWID IN (SELECT di.ROWID FROM "data_index_number" di LEFT JOIN "data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
            `DELETE FROM "data_eav_string" WHERE ROWID IN (SELECT di.ROWID FROM "data_eav_string" di LEFT JOIN "data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
            `DELETE FROM "data_eav_number" WHERE ROWID IN (SELECT di.ROWID FROM "data_eav_number" di LEFT JOIN "data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
        ]

        this.exec_core_plain(queries1, error => {
            if (error) {
                callback(error)
                return
            }
            this.orm.index.upsert(this.indexes.map(m => { return {prop: m.prop, type: m.type} }), error => {
                if (error) {
                    callback(error)
                    return
                }
                this.exec_core_plain(queries2, error => {
                    if (error) {
                        callback(error)
                        return
                    }
                    callback(undefined)
                })
            })
        })
    }

    /** delete all data index by pk */
    exec_data_delete_index (data_pks: Pk[], callback: (error: Error | undefined) => void): void {
        if (data_pks.length <= 0) {
            callback(undefined)
            return
        }
        this.orm.data_index_number.delete(['path', 'file'], data_pks, error => {
            if (error) {
                callback(error)
                return
            }
            this.orm.data_index_string.delete(['path', 'file'], data_pks, error => {
                if (error) {
                    callback(error)
                    return
                }
                callback(undefined)
            })
        })
    }

    /** delete all data eav by pk */
    exec_data_delete_eav (data_pks: Pk[], callback: (error: Error | undefined) => void): void {
        if (data_pks.length <= 0) {
            callback(undefined)
            return
        }
        this.orm.data_eav_number.delete(['path', 'file'], data_pks, error => {
            if (error) {
                callback(error)
                return
            }
            this.orm.data_eav_string.delete(['path', 'file'], data_pks, error => {
                if (error) {
                    callback(error)
                    return
                }
                callback(undefined)
            })
        })
    }

    /** delete all data (with indexes and eavs) by pk */
    exec_data_delete(data_pks: Pk[], callback: (error: Error | undefined) => void): void {
        if (data_pks.length <= 0) {
            callback(undefined)
            return
        }
        this.exec_data_delete_index(data_pks, error => {
            if (error) {
                callback(error)
                return
            }
            this.exec_data_delete_eav(data_pks, error => {
                if (error) {
                    callback(error)
                    return
                }
                this.orm.data.delete(['path', 'file'], data_pks, error => {
                    if (error) {
                        callback(error)
                        return
                    }
                    callback(undefined)
                })
            })
        })
    }

    /** parse data and adding indexes */
    exec_data_upsert_index(rows: {pk: Pk, data: string | undefined, indexes?: TypeOptionsStateIndex[] | undefined}[], callback: (error: Error | undefined) => void) {
        if (rows.length <= 0) {
            callback(undefined)
            return
        }
        const no_json_rows = [] as Row_DataEavString[]
        const index_number_rows = [] as Row_DataIndexNumber[]
        const index_string_rows = [] as Row_DataIndexString[]

        rows.forEach(row => {
            if (row.data === undefined) {
                no_json_rows.push({pk: row.pk, prop: 'no_json', value: vvs.formatDate(new Date(), 126)})
                return
            }

            try {
                const idxs = row.indexes || this.indexes
                const json = JSON.parse(row.data)
                idxs.forEach(index => {
                    if (index.type === 'number') {
                        index_number_rows.push({pk: row.pk, prop: index.prop, value: to_number(json[index.prop])})
                    } else if (index.type === 'string') {
                        index_string_rows.push({pk: row.pk, prop: index.prop, value: to_string(json[index.prop])})
                    }
                })
            } catch (error) {
                no_json_rows.push({pk: row.pk, prop: 'no_json', value: vvs.formatDate(new Date(), 126)})
            }

        })

        const index_with_pk = [] as Pk[]
        index_number_rows.forEach(i => {
            if (index_with_pk.some(f => f.equal(i.pk))) return
            index_with_pk.push(i.pk)
        })
        index_string_rows.forEach(i => {
            if (index_with_pk.some(f => f.equal(i.pk))) return
            index_with_pk.push(i.pk)
        })

        this.orm.data_eav_string.delete(['path', 'file', 'prop'], index_with_pk.map(m => { return {...m, prop: 'no_json'}  }), error => {
            if (error) {
                callback(error)
                return
            }
            this.exec_data_delete_index(no_json_rows.map(m => { return m.pk }), error => {
                if (error) {
                    callback(error)
                    return
                }
                this.orm.data_eav_string.upsert(no_json_rows, error => {
                    if (error) {
                        callback(error)
                        return
                    }
                    this.orm.data_index_string.upsert(index_string_rows, error => {
                        if (error) {
                            callback(error)
                            return
                        }
                        this.orm.data_index_number.upsert(index_number_rows, error => {
                            if (error) {
                                callback(error)
                                return
                            }
                            callback(undefined)
                        })
                    })
                })
            })
        })
    }

    /** adding missing indexes */
    exec_data_reindex(callback: (error: Error | undefined) => void) {
        const query = [
            `SELECT`,
            `   rn,`,
            `   CASE WHEN rn = 1 THEN "path" ELSE NULL END "path",`,
            `   CASE WHEN rn = 1 THEN "file" ELSE NULL END "file",`,
            `   CASE WHEN rn = 1 THEN "data" ELSE NULL END "data",`,
            `   "prop"`,
            `FROM (`,
            `    select ROW_NUMBER() OVER(PARTITION BY d."path", d."file" ORDER BY d."path", d."file") rn, d."path", d."file", d."data", i."prop" from "data" d, "index" i`,
            `    left join "data_index_number" din ON din."path" = d."path" AND din."file" = d."file" AND din."prop" = i."prop" AND i."type" = 'number'`,
            `    left join "data_index_string" dis ON dis."path" = d."path" AND dis."file" = d."file" AND dis."prop" = i."prop" AND i."type" = 'string'`,
            `    left join "data_eav_string" des ON des."path" = d."path" AND des."file" = d."file" AND des."prop" = 'no_json'`,
            `    where din."path" IS NULL AND dis."path" IS NULL AND des.path IS NULL`,
            `) ORDER BY "path", "file", rn`,
            `LIMIT 500`
        ].join(' ')
        this.exec_core_select(query, undefined, (error, raw_rows) => {
            if (error) {
                callback(error)
                return
            }
            if (raw_rows.length <= 0) {
                callback(undefined)
                return
            }
            const rows = [] as {pk: Pk, data: string | undefined, indexes: TypeOptionsStateIndex[]}[]
            let indexes = [] as TypeOptionsStateIndex[]
            let data = ''
            let path = ''
            let file = ''
            let prop = ''
            raw_rows.forEach(rr => {
                const rn = rr['rn'] as number
                prop = rr['prop'] as string

                if (rn === 1) {
                    if (indexes.length > 0) {
                        rows.push({
                            pk: new Pk(path, file),
                            data: data,
                            indexes: indexes
                        })
                    }
                    data = rr['data'] as string
                    path = rr['path'] as string
                    file = rr['file'] as string
                    indexes = []
                }
                indexes.push({prop: prop, type: this.indexes.find(f => f.prop === prop)?.type || 'string'})
            })
            if (indexes.length > 0) {
                rows.push({
                    pk: new Pk(path, file),
                    data: data,
                    indexes: indexes
                })
            }
            this.exec_data_upsert_index(rows, error => {
                if (error) {
                    callback(error)
                    return
                }
                this.exec_data_reindex(callback)
            })
        })
    }
}