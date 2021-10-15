import * as path from 'path'
import * as vv from 'vv-common'
import { TData, TypeDataHandler, TDataShowcase } from './typedata'
import * as z from './z'

export type TOptions =  {
    /** default root path for storage your data files, example = path.join(__dirname, 'storage', 'data') */
    pathData: string,
    /** default path for storage map (sqlite) files, example = path.join(__dirname, 'storage', 'map') */
    pathMap: string | 'MEMORY',
    /** timeout(msec) for callbacks "state change", default 1000, min 100, max 100000  */
    callbackStateChangeDelay?: number,
    states: TOptionsState[]
}

export type TIndex = 'number' | 'string'

export type TOptionsState = {
    /** name state */
    name: string,
    /** path for storage state data files, default = path.join(path_data from a higher level, state name ) */
    pathData?: string,
    /** path for storage map (sqlite) files, default = path_map from a higher level */
    pathMap?: string | 'MEMORY',
    /** type storaged in files data, default = json  */
    typeData?: TData
    /** type data in get functions, default = native  */
    typeDataShowcase?: TDataShowcase
    /** index properties, for speed up read data, for type_data = 'json' */
    indexes?: TOptionsStateIndex[]
}

export type TOptionsStateIndex = {
    /** property name from json */
    prop: string,
    /** property type from json */
    type: TIndex
}

export type TEnvState = {
    name: string,
    pathData: string,
    pathMap: string | 'MEMORY',
    typeData: TData,
    typeDataShowcase: TDataShowcase,
    indexes: TOptionsStateIndex[]
}

export type TStateRow = {
    path: string,
    file: string,
    data?: any | string,
    indexes?: {prop: string, value: number | string, type: TIndex}[]
}

export type TSetCallback = {
    key: string,
    error: Error
}

export type TChannelWorkerFrom =
    {type: 'message_trace', trace: string} |
    {type: 'message_debug', debug: string} |
    {type: 'message_error', error: string} |
    {type: 'state_complete'} |
    {type: 'state_change', rows: {action: 'insert' | 'delete', state: string, rows: TStateRow[]}[], sets: TSetCallback[] } |
    {type: 'get.obtain', key: string, error: Error, rows: {state: string, rows: TStateRow[]}[]} |
    {type: 'get.query', key: string, error: Error, rows: {state: string, rows: TStateRow[]}[]}

export type TChannelWorkerTo =
    {type: 'get.obtain', key: string, filter: TChannelStateFilterObtain[]} |
    {type: 'get.query', key: string, filter: TChannelStateFilterQuery[]} |
    {type: 'set', key: string, sets: TStateRowChange[]}

export type TChannelStateFilterObtain = {
    state: string,
    filterPath?: string,
    filterFile?: string,
    filters?: {index: string, value: string | number}[]
}

export type TChannelStateFilterQuery = {
    state: string,
    filterGlobal?: string,
    filters?: {index: string, query: string}[]
}

export type TStateRowChange =
    {action: 'insert', state: string, rows: {path: string, file: string, data: any | string}[]} |
    {action: 'delete', state: string, rows: {path: string, file: string}[]}

export class Env {
    readonly pathData: string
    readonly pathMap: string | 'MEMORY'
    readonly callbackStateChangeDelay: number
    readonly states: TEnvState[]
    callback: {
        allowError: boolean,
        allowDebug: boolean,
        allowTrace: boolean,
        isStateComplete: boolean,
        isStateChange: boolean
    }

    constructor(options: TOptions) {
        this.callback = {
            allowError: false,
            allowDebug: false,
            allowTrace: false,
            isStateComplete: false,
            isStateChange: false
        }

        this.pathData = path.resolve(z.Dir(options.pathData))
        if (vv.isEmpty(this.pathData)) {
            throw new Error (`path_data cannot be empty`)
        }
        this.pathMap = options.pathMap === 'MEMORY' ? 'MEMORY' : path.resolve(z.Dir(options.pathMap))
        if (vv.isEmpty(this.pathMap)) {
            throw new Error (`path_map cannot be empty`)
        }

        this.callbackStateChangeDelay = (vv.isEmpty(options.callbackStateChangeDelay) ? 1000 : options.callbackStateChangeDelay) as number
        if (this.callbackStateChangeDelay < 100) this.callbackStateChangeDelay = 100
        if (this.callbackStateChangeDelay > 100000) this.callbackStateChangeDelay = 100000

        this.states = (vv.isEmpty(options.states) ? [] : options.states.map(m => {
            const typeData = new TypeDataHandler(m.typeData, m.typeDataShowcase)
            return {
                name: m.name,
                pathData: z.Dir(vv.nz(m.pathData, path.join(this.pathData, m.name))),
                pathMap: z.Dir(vv.nz(m.pathMap, this.pathMap)),
                typeData: typeData.typedata,
                typeDataShowcase: typeData.typedataShowcase,
                indexes: (vv.isEmpty(m.indexes) ? [] : m.indexes) as TOptionsStateIndex[]
            }
        })) as TEnvState[]

        this.states.forEach((state, stateIdx) => {
            if (vv.isEmpty(state.name)) {
                throw new Error (`state #${stateIdx} cannot have an empty name`)
            }

            if (vv.equal(state.pathData, state.pathMap)) {
                throw new Error (`state "${state.name}" contains same path_data and path_map: "${state.pathData}"`)
            }

            if (state.typeData !== 'json' && state.indexes.length > 0) {
                throw new Error (`state "${state.name}" with type data "${state.typeData}" can't has indexes`)
            }

            state.indexes.forEach((index, indexIdx) => {
                if (vv.isEmpty(index.prop)) {
                    throw new Error (`in state "${state.name}" index #${indexIdx} cannot have an empty prop`)
                }
                if (vv.isEmpty(index.type)) {
                    throw new Error (`in state "${state.name}" index "${index.prop}" cannot have an empty value`)
                }
            })
            const indexPropDoubles = z.Duplicates(state.indexes.map(m => { return m.prop }))
            if (indexPropDoubles.length > 0) {
                throw new Error (`state "${state.name}" contains duplicate prop: "${indexPropDoubles.join('", "')}"`)
            }
        })

        this.states.forEach((state1, idx1) => {
            this.states.forEach((state2, idx2) => {
                if (idx1 === idx2) return
                if (vv.equal(state1.pathData, state2.pathData)) {
                    throw new Error (`states "${state1.name}" and "${state2.name}" has same path_data "${state1.pathData}"`)
                }
                if (state1.pathData.length > state2.pathData.length && vv.equal(state1.pathData.substring(0, state2.pathData.length), state2.pathData)) {
                    throw new Error (`path_data in state "${state2.name}" is part of path_data in state "${state1.name}"`)
                }
                if (state2.pathData.length > state1.pathData.length && vv.equal(state2.pathData.substring(0, state1.pathData.length), state1.pathData)) {
                    throw new Error (`path_data in state "${state1.name}" is part of path_data in state "${state2.name}"`)
                }
                if (vv.equal(state1.pathMap, state2.pathData)) {
                    throw new Error (`state "${state1.name}" has the same path_map as states's "${state2.name}" path_data`)
                }
                if (state1.pathMap.length > state2.pathData.length && vv.equal(state1.pathMap.substring(0, state2.pathData.length), state2.pathData.length)) {
                    throw new Error (`path_data in state "${state2.name}" is part of path_map in state "${state1.name}"`)
                }
                if (state2.pathData.length > state1.pathMap.length && vv.equal(state2.pathData.substring(0, state1.pathMap.length), state1.pathMap.length)) {
                    throw new Error (`path_map in state "${state1.name}" is part of path_data in state "${state2.name}"`)
                }
            })
        })

    }
}