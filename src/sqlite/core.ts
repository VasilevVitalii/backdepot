import { Database } from 'better-sqlite3'
import * as vvs from 'vv-shared'

export function build_filter_select (filter: {field: string, value: string | number}[] | undefined): {where: string, params: any} {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function build_filter_delete (filter_fields: string[], filter_values: any[]) : {where: string, params: any[]} {
    const params = [] as any[]
    const where = [] as string[]

    filter_fields.forEach(f => {
        where.push(`"${f}" = @${f}`)
    })

    filter_values.forEach(v => {
        const param = {}
        filter_fields.forEach(f => {
            param[f] = v[f]
        })
        params.push(param)
    })

    return {
        where: where.length > 0 ? `WHERE ${where.join(" AND ")}` : '',
        params: params
    }
}

export function build_fields (fields: string[] | undefined): string {
    if (!fields || fields.length <= 0) return '*'
    return fields.map(m => { return `"${m}"` }).join(',')
}

export function exec_prepared(base: Database, query: string, params: any[], callback: (error: Error | undefined) => void) {
    if (vvs.isEmptyString(query) || params.length <= 0) {
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

export function exec_plain(base: Database, queries: string[], idx: number, callback: (error: Error | undefined) => void) {
    if (idx >= queries.length) {
        callback(undefined)
        return
    }
    const q = queries[idx]
    if (vvs.isEmptyString(q)) {
        idx++
        exec_plain(base, queries, idx, callback)
        return
    }
    try {
        base.exec(q)
        idx++
        exec_plain(base, queries, idx, callback)
    } catch (error) {
        callback(new Error(`"${(error as Error).message}" in query "${q}"`))
        return
    }
}

export function exec_select (base: Database, query: string, param: any | undefined, callback: (error: Error | undefined, rows: any[]) => void) {
    if (vvs.isEmptyString(query)) {
        callback(undefined, [])
        return
    }
    try {
        const rows = vvs.isEmpty(param) ? base.prepare(query).all() : base.prepare(query).all(param)
        callback(undefined, rows || [])
    } catch (error) {
        callback(new Error(`"${(error as Error).message}" in query "${query}"`), [])
    }
}

export function orm_delete(db: Database, table_name: string, filter_fields: string[], filter_values: any[], callback: (error: Error | undefined) => void): void {
    if (filter_fields.length <= 0) {
        callback(undefined)
        return
    }
    const w = build_filter_delete(filter_fields, filter_values)
    exec_prepared(db, `DELETE FROM "${table_name}" ${w.where}`, w.params, callback)
}

export function orm_select(db: Database, table_name: string, fields: string[] | undefined, filter: {field: string, value: string | number}[] | undefined, callback: (error: Error | undefined, rows: any[]) => void) {
    const w = build_filter_select(filter)
    const f = build_fields(fields)
    exec_select(db, `SELECT ${f} FROM "${table_name}" ${w.where}`, w.params, callback)
}