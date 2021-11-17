import * as vv from 'vv-common'
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
import { TRow as Row_DataEavString } from './table.data_eav_string'
import { TRow as Row_DataIndexNumber } from './table.data_index_number'
import { TRow as Row_DataIndexString } from './table.data_index_string'
import { TOptionsStateIndex } from '../index.env'
import { Pk } from '../pk'
import { ToNumber, ToString } from '../z'

export class Sqlite {
    readonly schemaver = 1

    readonly base: sqlite_driver.Database

    readonly orm: {
        dataEavNumber: Table_DataEavNumber,
        dataEavString: Table_DataEavString,
        dataIndexNumber: Table_DataIndexNumber,
        dataIndexString: Table_DataIndexString,
        data: Table_Data,
        eavNumber: Table_EavNumber,
        eavString: Table_EavString,
        index: Table_Index,
    }

    readonly indexes: TOptionsStateIndex[]

    constructor(fullFileName: string, indexes: TOptionsStateIndex[], callbackQuery: ((query: string) => void) | undefined ) {
        this.base = new sqlite_driver.default(
            fullFileName === 'MEMORY' ? ':memory:' : fullFileName,
            {
                verbose: typeof callbackQuery === 'function'
                    ?
                    function(message) {
                        callbackQuery(`sqlite: ${message}`)
                    }
                    :
                    undefined
            }
        )
        this.indexes = indexes
        this.orm = {
            dataEavNumber: new Table_DataEavNumber(this.base),
            dataEavString: new Table_DataEavString(this.base),
            dataIndexNumber: new Table_DataIndexNumber(this.base),
            dataIndexString: new Table_DataIndexString(this.base),
            data: new Table_Data(this.base),
            eavNumber: new Table_EavNumber(this.base),
            eavString: new Table_EavString(this.base),
            index: new Table_Index(this.base)
        }
    }

    execCorePrepared(query: string, params: any[], callback: (error: Error | undefined) => void) {
        core.ExecPrepared(this.base, query, params, callback)
    }

    execCorePlain(queries: string[], callback: (error: Error | undefined) => void) {
        core.ExecPlain(this.base, queries, 0, callback)
    }

    execCoreSelect (query: string, param: any | undefined, callback: (error: Error | undefined, rows: any[]) => void) {
        core.ExecSelect(this.base, query, param, callback)
    }

    execInit(callback: (error: Error | undefined) => void): void {
        const queries1 = [
            //`PRAGMA journal_mode = WAL`,
            //`PRAGMA synchronous = NORMAL`,
            `CREATE TABLE IF NOT EXISTS "EavString" ("prop" TEXT NOT NULL PRIMARY KEY, "value" TEXT)`,
            `CREATE TABLE IF NOT EXISTS "EavNumber" ("prop" TEXT NOT NULL PRIMARY KEY, "value" INTEGER)`,
            `CREATE TABLE IF NOT EXISTS "Index" ("prop" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL)`,
            `CREATE TABLE IF NOT EXISTS "Data" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "data" TEXT, "fsstatSize" INTEGER, "fsstatMtimeMs" INTEGER, "fsstatCtimeMs" INTEGER, "fsstatBirthtimeMs" INTEGER, PRIMARY KEY("path", "file"))`,
            `CREATE TABLE IF NOT EXISTS "DataIndexString" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "level" TEXT NOT NULL, "value" TEXT, PRIMARY KEY("path", "file", "prop", "level"))`,
            `CREATE TABLE IF NOT EXISTS "DataIndexNumber" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "level" TEXT NOT NULL, "value" INTEGER, PRIMARY KEY("path", "file", "prop", "level"))`,
            `CREATE TABLE IF NOT EXISTS "DataEavString" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "value" TEXT, PRIMARY KEY("path", "file", "prop"))`,
            `CREATE TABLE IF NOT EXISTS "DataEavNumber" ("path" TEXT NOT NULL, "file" TEXT NOT NULL, "prop" TEXT NOT NULL, "value" INTEGER, PRIMARY KEY("path", "file", "prop"))`,
            `INSERT INTO "EavNumber"("prop", "value") SELECT 'schemaver', '${this.schemaver}' WHERE NOT EXISTS (SELECT 1 FROM "EavNumber" WHERE "prop" = 'schemaver')`,
            `DELETE FROM "Index"`
        ]
        const queries2 = [
            `DELETE FROM "DataIndexNumber" WHERE "prop" NOT IN (SELECT "prop" FROM "Index" WHERE "value" = 'number')`,
            `DELETE FROM "DataIndexString" WHERE "prop" NOT IN (SELECT "prop" FROM "Index" WHERE "value" = 'string')`,
            `DELETE FROM "DataIndexString" WHERE ROWID IN (SELECT di.ROWID FROM "DataIndexString" di LEFT JOIN "Data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
            `DELETE FROM "DataIndexNumber" WHERE ROWID IN (SELECT di.ROWID FROM "DataIndexNumber" di LEFT JOIN "Data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
            `DELETE FROM "DataEavString" WHERE ROWID IN (SELECT di.ROWID FROM "DataEavString" di LEFT JOIN "Data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
            `DELETE FROM "DataEavNumber" WHERE ROWID IN (SELECT di.ROWID FROM "DataEavNumber" di LEFT JOIN "Data" d ON d."path" = di."path" AND d."file" = di."file" WHERE d."path" IS NULL)`,
        ]

        this.execCorePlain(queries1, error => {
            if (error) {
                callback(error)
                return
            }
            this.orm.index.upsert(this.indexes.map(m => { return {prop: m.prop, type: m.type} }), error => {
                if (error) {
                    callback(error)
                    return
                }
                this.execCorePlain(queries2, error => {
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
    execDataDeleteIndex (dataPks: Pk[], callback: (error: Error | undefined) => void): void {
        if (dataPks.length <= 0) {
            callback(undefined)
            return
        }
        this.orm.dataIndexNumber.delete(['path', 'file'], dataPks, error => {
            if (error) {
                callback(error)
                return
            }
            this.orm.dataIndexString.delete(['path', 'file'], dataPks, error => {
                if (error) {
                    callback(error)
                    return
                }
                callback(undefined)
            })
        })
    }

    /** delete all data eav by pk */
    execDataDeleteEav (dataPks: Pk[], callback: (error: Error | undefined) => void): void {
        if (dataPks.length <= 0) {
            callback(undefined)
            return
        }
        this.orm.dataEavNumber.delete(['path', 'file'], dataPks, error => {
            if (error) {
                callback(error)
                return
            }
            this.orm.dataEavString.delete(['path', 'file'], dataPks, error => {
                if (error) {
                    callback(error)
                    return
                }
                callback(undefined)
            })
        })
    }

    /** delete all data (with indexes and eavs) by pk */
    execDataDelete(dataPks: Pk[], callback: (error: Error | undefined) => void): void {
        if (dataPks.length <= 0) {
            callback(undefined)
            return
        }
        this.execDataDeleteIndex(dataPks, error => {
            if (error) {
                callback(error)
                return
            }
            this.execDataDeleteEav(dataPks, error => {
                if (error) {
                    callback(error)
                    return
                }
                this.orm.data.delete(['path', 'file'], dataPks, error => {
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
    execDataUpsertIndex(rows: {pk: Pk, data: string | undefined, indexes?: TOptionsStateIndex[] | undefined}[], callback: (error: Error | undefined) => void) {
        if (rows.length <= 0) {
            callback(undefined)
            return
        }
        const noJsonRows = [] as Row_DataEavString[]
        const indexNumberRows = [] as Row_DataIndexNumber[]
        const indexStringRows = [] as Row_DataIndexString[]

        rows.forEach(row => {
            if (row.data === undefined) {
                noJsonRows.push({pk: row.pk, prop: 'no_json', value: vv.dateFormat(new Date(), '126')})
                return
            }

            try {
                const idxs = row.indexes || this.indexes
                const json = JSON.parse(row.data)
                idxs.forEach(index => {
                    //TODO create tree
                    // const propTree = index.prop.split('.')
                    // let value = json
                    // for (let i = 0; i < propTree.length; i++) {
                    //     if (value === undefined) break
                    //     value = value[propTree[i]]
                    // }

                    if (index.type === 'number') {
                        indexNumberRows.push({pk: row.pk, prop: index.prop, level: 'O', value: ToNumber(json[index.prop])})
                    } else if (index.type === 'string') {
                        indexStringRows.push({pk: row.pk, prop: index.prop, level: 'O', value: ToString(json[index.prop])})
                    }
                })
            } catch (error) {
                noJsonRows.push({pk: row.pk, prop: 'no_json', value: vv.dateFormat(new Date(), '126')})
            }

        })

        const indexWithPk = [] as Pk[]
        indexNumberRows.forEach(i => {
            if (indexWithPk.some(f => f.equal(i.pk))) return
            indexWithPk.push(i.pk)
        })
        indexStringRows.forEach(i => {
            if (indexWithPk.some(f => f.equal(i.pk))) return
            indexWithPk.push(i.pk)
        })

        this.orm.dataEavString.delete(['path', 'file', 'prop'], indexWithPk.map(m => { return {...m, prop: 'no_json'}  }), error => {
            if (error) {
                callback(error)
                return
            }
            this.execDataDeleteIndex(noJsonRows.map(m => { return m.pk }), error => {
                if (error) {
                    callback(error)
                    return
                }
                this.orm.dataEavString.upsert(noJsonRows, error => {
                    if (error) {
                        callback(error)
                        return
                    }
                    this.orm.dataIndexString.upsert(indexStringRows, error => {
                        if (error) {
                            callback(error)
                            return
                        }
                        this.orm.dataIndexNumber.upsert(indexNumberRows, error => {
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
    execDataReindex(callback: (error: Error | undefined) => void) {
        const query = [
            `SELECT`,
            `   rn,`,
            `   CASE WHEN rn = 1 THEN "path" ELSE NULL END "path",`,
            `   CASE WHEN rn = 1 THEN "file" ELSE NULL END "file",`,
            `   CASE WHEN rn = 1 THEN "data" ELSE NULL END "data",`,
            `   "prop"`,
            `FROM (`,
            `    select ROW_NUMBER() OVER(PARTITION BY d."path", d."file" ORDER BY d."path", d."file") rn, d."path", d."file", d."data", i."prop" from "Data" d, "Index" i`,
            `    left join "DataIndexNumber" din ON din."path" = d."path" AND din."file" = d."file" AND din."prop" = i."prop" AND i."type" = 'number'`,
            `    left join "DataIndexString" dis ON dis."path" = d."path" AND dis."file" = d."file" AND dis."prop" = i."prop" AND i."type" = 'string'`,
            `    left join "DataEavString" des ON des."path" = d."path" AND des."file" = d."file" AND des."prop" = 'no_json'`,
            `    where din."path" IS NULL AND dis."path" IS NULL AND des.path IS NULL`,
            `) ORDER BY "path", "file", rn`,
            `LIMIT 500`
        ].join(' ')
        this.execCoreSelect(query, undefined, (error, rawRows) => {
            if (error) {
                callback(error)
                return
            }
            if (rawRows.length <= 0) {
                callback(undefined)
                return
            }
            const rows = [] as {pk: Pk, data: string | undefined, indexes: TOptionsStateIndex[]}[]
            let indexes = [] as TOptionsStateIndex[]
            let data = ''
            let path = ''
            let file = ''
            let prop = ''
            rawRows.forEach(rr => {
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
            this.execDataUpsertIndex(rows, error => {
                if (error) {
                    callback(error)
                    return
                }
                this.execDataReindex(callback)
            })
        })
    }
}