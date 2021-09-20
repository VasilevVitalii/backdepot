import * as vvs from 'vv-shared'
import { State } from "."
import { TypeIndex, TypeStateRow } from '../index.env'

export function select_by_props(
    state: State,
    filter_path: string | undefined,
    filter_file: string | undefined,
    filter_index_string: {index: string, value: string}[],
    filter_index_number: {index: string, value: number}[],
    callback: (error: Error | undefined, rows: TypeStateRow[]) => void
) {
    const filters_join = [] as string[]
    const filters_where = [] as string[]

    filter_index_string.forEach((f, f_idx) => {
        const name = `dis${f_idx}`
        filters_join.push(`JOIN "data_index_string" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND ${name}."value" ${ffs(f.value)}`)
    })
    filter_index_number.forEach((f, f_idx) => {
        const name = `din${f_idx}`
        filters_join.push(`JOIN "data_index_number" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND ${name}."value" ${ffn(f.value)}`)
    })

    if (filter_path) {
        filters_where.push(`d."path" '${ffs(filter_path)}'`)
    }
    if (filter_file) {
        filters_where.push(`d."file" '${ffs(filter_file)}'`)
    }

    select(state, filters_join, filters_where, callback)
}

export function select_by_query(
    state: State,
    filter_global: string | undefined,
    filter_index_string: {index: string, query: string}[],
    filter_index_number: {index: string, query: string}[],
    callback: (error: Error | undefined, rows: TypeStateRow[]) => void
) {
    const filters_join = [] as string[]
    const filters_where = [] as string[]

    filter_index_string.filter(f => !vvs.isEmptyString(f.query)).forEach((f, f_idx) => {
        const name = `dis${f_idx}`
        const subquery = vvs.replaceAll(f.query, '$value', `${name}."value"`)
        filters_join.push(`JOIN "data_index_string" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND (${subquery})`)
    })
    filter_index_number.filter(f => !vvs.isEmptyString(f.query)).forEach((f, f_idx) => {
        const name = `din${f_idx}`
        const subquery = vvs.replaceAll(f.query, '$value', `${name}."value"`)
        filters_join.push(`JOIN "data_index_number" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND (${subquery})`)
    })

    if (!vvs.isEmptyString(filter_global)) {
        let subquery = vvs.replaceAll(filter_global, '$path',`d."path"`)
        subquery = vvs.replaceAll(subquery, '$file',`d."file"`)
        filters_where.push(` ${subquery}`)
    }

    select(state, filters_join, filters_where, callback)
}

function select(state: State, filters_join: string[], filters_where: string[], callback: (error: Error | undefined, rows: TypeStateRow[]) => void) {
    const query_data = `SELECT d."path", d."file", d."data" FROM "data" d `
        .concat(filters_join.length > 0 ? filters_join.join(' ') : ' ')
        .concat(filters_where.length > 0 ? ` WHERE ${filters_where.join(' AND ')}` : ' ')
    const query_indexes_string = `SELECT d."path", d."file", dis."prop", dis."value" FROM "data" d `
        .concat(filters_join.length > 0 ? filters_join.join(' ') : ' ')
        .concat(` JOIN "data_index_string" dis ON dis."path" = d."path" AND dis."file" = d."file"`)
    const query_indexes_number = `SELECT d."path", d."file", din."prop", din."value" FROM "data" d `
        .concat(filters_join.length > 0 ? filters_join.join(' ') : ' ')
        .concat(` JOIN "data_index_number" din ON din."path" = d."path" AND din."file" = d."file"`)

    state.sqlite.exec_core_select(query_data, undefined, (error, data_rows) => {
        if (error) {
            state.callback_error(`select: "${error.message}"`)
            callback(error, [])
            return
        }

        if (data_rows.length <= 0) {
            callback(undefined, data_rows.map(m => { return { path: m['path'], file: m['file'], data: m['data'] } }))
            return
        }

        select_indexes('string', state, query_indexes_string, (error, indexes_string) => {
            if (error) {
                state.callback_error(`select: "${error.message}"`)
                callback(error, [])
                return
            }
            select_indexes('number', state, query_indexes_number, (error, indexes_number) => {
                if (error) {
                    state.callback_error(`select: "${error.message}"`)
                    callback(error, [])
                    return
                }

                callback(undefined, data_rows.map(m => {
                    return {
                        path: m['path'],
                        file: m['file'],
                        data: m['data'],
                        indexes: [
                            ...indexes_string.filter(f => f.path === m['path'] && f.file === m['file']).map(m => { return { prop: m.prop, value: m.value, type: 'string' as TypeIndex } }),
                            ...indexes_number.filter(f => f.path === m['path'] && f.file === m['file']).map(m => { return { prop: m.prop, value: m.value, type: 'number' as TypeIndex } }),
                        ]
                    }
                }))
            })
        })
    })
}

function select_indexes(index_type: string, state: State, query: string, callback: (error: Error | undefined, indexes: {path: string, file: string, prop: string, value: string | number}[]) => void) {
    if (!state.indexes.some(f => f.type === index_type)) {
        callback(undefined, [])
        return
    }
    state.sqlite.exec_core_select(query, undefined, (error, index_string_rows) => {
        if (error) {
            callback(error, [])
        } else {
            callback(undefined, index_string_rows.map(m => { return {
                path: m['path'],
                file: m['file'],
                prop: m['prop'],
                value: m['value']
            }}))
        }
    })
}

function ffs(s: string): string {
    if (vvs.isEmpty(s)) return 'IS NULL'
    return ` = '${s.replace(/'/g,"''")}'`
}

function ffn(n: number): string {
    if (vvs.isEmpty(n)) return 'IS NULL'
    return ` = ${n}`
}