import * as vv from 'vv-common'
import { State } from "./index"
import { TIndex, TStateRow } from '../index.env'

export function SelectByProps(
    state: State,
    filterPath: string | undefined,
    filterFile: string | undefined,
    filterIndexString: {index: string, value: string}[],
    filterIndexNumber: {index: string, value: number}[],
    callback: (error: Error | undefined, rows: TStateRow[]) => void
) {
    const filtersJoin = [] as string[]
    const filtersWhere = [] as string[]

    filterIndexString.forEach((f, fIdx) => {
        const name = `dis${fIdx}`
        filtersJoin.push(`JOIN "DataIndexString" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND ${name}."value" ${ffs(f.value)}`)
    })
    filterIndexNumber.forEach((f, fIdx) => {
        const name = `din${fIdx}`
        filtersJoin.push(`JOIN "DataIndexNumber" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND ${name}."value" ${ffn(f.value)}`)
    })

    if (filterPath) {
        filtersWhere.push(`d."path" '${ffs(filterPath)}'`)
    }
    if (filterFile) {
        filtersWhere.push(`d."file" '${ffs(filterFile)}'`)
    }

    select(state, filtersJoin, filtersWhere, callback)
}

export function SelectByQuery(
    state: State,
    filterGlobal: string | undefined,
    filterIndexString: {index: string, query: string}[],
    filterIndexNumber: {index: string, query: string}[],
    callback: (error: Error | undefined, rows: TStateRow[]) => void
) {
    const filtersJoin = [] as string[]
    const filtersWhere = [] as string[]

    filterIndexString.filter(f => !vv.isEmpty(f.query)).forEach((f, fIdx) => {
        const name = `dis${fIdx}`
        const subquery = f.query.replace(/\$value/g, `${name}."value"`)
        filtersJoin.push(`JOIN "DataIndexString" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND (${subquery})`)
    })
    filterIndexNumber.filter(f => !vv.isEmpty(f.query)).forEach((f, fIdx) => {
        const name = `din${fIdx}`
        const subquery = f.query.replace(/\$value/g, `${name}."value"`)
        filtersJoin.push(`JOIN "DataIndexNumber" ${name} ON ${name}."path" = d."path" AND ${name}."file" = d."file" AND ${name}."prop" ${ffs(f.index)} AND (${subquery})`)
    })

    if (!vv.isEmpty(filterGlobal)) {
        let subquery = filterGlobal.replace(/\$path/g,`d."path"`)
        subquery = subquery.replace(/\$file/g,`d."file"`)
        filtersWhere.push(` ${subquery}`)
    }

    select(state, filtersJoin, filtersWhere, callback)
}

function select(state: State, joinFilters: string[], whereFilters: string[], callback: (error: Error | undefined, rows: TStateRow[]) => void) {
    const queryData = `SELECT d."path", d."file", d."data" FROM "Data" d `
        .concat(joinFilters.length > 0 ? joinFilters.join(' ') : ' ')
        .concat(whereFilters.length > 0 ? ` WHERE ${whereFilters.join(' AND ')}` : ' ')
    const queryIndexesString = `SELECT d."path", d."file", dis."prop", dis."value" FROM "Data" d `
        .concat(joinFilters.length > 0 ? joinFilters.join(' ') : ' ')
        .concat(` JOIN "DataIndexString" dis ON dis."path" = d."path" AND dis."file" = d."file"`)
    const queryIndexesNumber = `SELECT d."path", d."file", din."prop", din."value" FROM "Data" d `
        .concat(joinFilters.length > 0 ? joinFilters.join(' ') : ' ')
        .concat(` JOIN "DataIndexNumber" din ON din."path" = d."path" AND din."file" = d."file"`)

    state.sqlite.execCoreSelect(queryData, undefined, (error, dataRows) => {
        if (error) {
            state.callbackError(`select: "${error.message}"`)
            callback(error, [])
            return
        }

        if (dataRows.length <= 0) {
            callback(undefined, dataRows.map(m => { return { path: m['path'], file: m['file'], data: m['data'] } }))
            return
        }

        selectIndexes('string', state, queryIndexesString, (error, stringIndexes) => {
            if (error) {
                state.callbackError(`select: "${error.message}"`)
                callback(error, [])
                return
            }
            selectIndexes('number', state, queryIndexesNumber, (error, numberIndexes) => {
                if (error) {
                    state.callbackError(`select: "${error.message}"`)
                    callback(error, [])
                    return
                }

                callback(undefined, dataRows.map(m => {
                    return {
                        path: m['path'],
                        file: m['file'],
                        data: m['data'],
                        indexes: [
                            ...stringIndexes.filter(f => f.path === m['path'] && f.file === m['file']).map(m => { return { prop: m.prop, value: m.value, type: 'string' as TIndex } }),
                            ...numberIndexes.filter(f => f.path === m['path'] && f.file === m['file']).map(m => { return { prop: m.prop, value: m.value, type: 'number' as TIndex } }),
                        ]
                    }
                }))
            })
        })
    })
}

function selectIndexes(indexType: string, state: State, query: string, callback: (error: Error | undefined, indexes: {path: string, file: string, prop: string, value: string | number}[]) => void) {
    if (!state.indexes.some(f => f.type === indexType)) {
        callback(undefined, [])
        return
    }
    state.sqlite.execCoreSelect(query, undefined, (error, indexStringRows) => {
        if (error) {
            callback(error, [])
        } else {
            callback(undefined, indexStringRows.map(m => { return {
                path: m['path'],
                file: m['file'],
                prop: m['prop'],
                value: m['value']
            }}))
        }
    })
}

function ffs(s: string): string {
    if (vv.isEmpty(s)) return 'IS NULL'
    return ` = '${s.replace(/'/g,"''")}'`
}

function ffn(n: number): string {
    if (vv.isEmpty(n)) return 'IS NULL'
    return ` = ${n}`
}