import { Database } from 'better-sqlite3'
import * as vv from 'vv-common'

export function BuildFilterSelect (filter: {field: string, value: string | number}[] | undefined): {where: string, params: any} {
    if (!filter) {
        return {
            where: '',
            params: {}
        }
    }
    const p = {}
    const q = [] as string[]
    filter.forEach(item => {
        q.push(`"${item.field}" = @${item.field}`)
        p[`${item.field}`] = item.value
    })
    return {
        where: q.length > 0 ? `WHERE ${q.join(" AND ")}` : '',
        params: p
    }
}

export function BuildFilterDelete (filterFields: string[], filterValues: any[]) : {where: string, params: any[]} {
    const params = [] as any[]
    const where = [] as string[]

    filterFields.forEach(f => {
        where.push(`"${f}" = @${f}`)
    })

    filterValues.forEach(v => {
        const param = {}
        filterFields.forEach(f => {
            param[f] = v[f]
        })
        params.push(param)
    })

    return {
        where: where.length > 0 ? `WHERE ${where.join(" AND ")}` : '',
        params: params
    }
}

export function BuildFields (fields: string[] | undefined): string {
    if (!fields || fields.length <= 0) return '*'
    return fields.map(m => { return `"${m}"` }).join(',')
}

export function ExecPrepared(base: Database, query: string, params: any[], callback: (error: Error | undefined) => void) {
    if (vv.isEmpty(query) || params.length <= 0) {
        callback(undefined)
        return
    }
    try {
        const stmt = base.prepare(query)
        const go = base.transaction(() => {
            for (let i = 0; i < params.length; i++) {
                try {
                    stmt.run(params[i])
                } catch (error) {
                    callback(error as Error)
                    return
                }
            }
            callback(undefined)
        })
        go()
    } catch (error) {
        callback(error as Error)
    }
}

export function ExecPlain(base: Database, queries: string[], idx: number, callback: (error: Error | undefined) => void) {
    if (idx >= queries.length) {
        callback(undefined)
        return
    }
    const q = queries[idx]
    if (vv.isEmpty(q)) {
        idx++
        ExecPlain(base, queries, idx, callback)
        return
    }
    try {
        base.exec(q)
        idx++
        ExecPlain(base, queries, idx, callback)
    } catch (error) {
        callback(new Error(`"${(error as Error).message}" in query "${q}"`))
        return
    }
}

export function ExecSelect (base: Database, query: string, param: any | undefined, callback: (error: Error | undefined, rows: any[]) => void) {
    if (vv.isEmpty(query)) {
        callback(undefined, [])
        return
    }
    try {
        const rows = vv.isEmpty(param) ? base.prepare(query).all() : base.prepare(query).all(param)
        callback(undefined, rows || [])
    } catch (error) {
        callback(new Error(`"${(error as Error).message}" in query "${query}"`), [])
    }
}

export function OrmDelete(db: Database, tableName: string, filterFields: string[], filterValues: any[], callback: (error: Error | undefined) => void): void {
    if (filterFields.length <= 0) {
        callback(undefined)
        return
    }
    const w = BuildFilterDelete(filterFields, filterValues)
    ExecPrepared(db, `DELETE FROM "${tableName}" ${w.where}`, w.params, callback)
}

export function OrmSelect(db: Database, tableName: string, fields: string[] | undefined, filter: {field: string, value: string | number}[] | undefined, callback: (error: Error | undefined, rows: any[]) => void) {
    const w = BuildFilterSelect(filter)
    const f = BuildFields(fields)
    ExecSelect(db, `SELECT ${f} FROM "${tableName}" ${w.where}`, w.params, callback)
}