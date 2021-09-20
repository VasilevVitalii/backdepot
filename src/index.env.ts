import * as path from 'path'
import * as vvs from 'vv-shared'
import { TypeData, TypeDataHandler, TypeDataShowcase } from './typedata'
import * as z from './z'

export type TypeOptions =  {
    /** default root path for storage your data files, example = path.join(__dirname, 'storage', 'data') */
    path_data: string,
    /** default path for storage map (sqlite) files, example = path.join(__dirname, 'storage', 'map') */
    path_map: string,
    /** timeout(msec) for callbacks "state change", default 1000, min 100, max 100000  */
    callback_state_change_delay?: number,
    states: TypeOptionsState[]
}

export type TypeIndex = 'number' | 'string'

export type TypeOptionsState = {
    /** name state */
    name: string,
    /** path for storage state data files, default = path.join(path_data from a higher level, state name ) */
    path_data?: string,
    /** path for storage map (sqlite) files, default = path_map from a higher level */
    path_map?: string,
    /** type storaged in files data, default = json  */
    type_data?: TypeData
    /** type data in get functions, default = native  */
    type_data_showcase?: TypeDataShowcase
    /** index properties, for speed up read data, for type_data = 'json' */
    indexes?: TypeOptionsStateIndex[]
}

export type TypeOptionsStateIndex = {
    /** property name from json */
    prop: string,
    /** property type from json */
    type: TypeIndex
}

export type TypeEnvState = {
    name: string,
    path_data: string,
    path_map: string,
    type_data: TypeData,
    type_data_showcase: TypeDataShowcase,
    indexes: TypeOptionsStateIndex[]
}

export type TypeStateRow = {
    path: string,
    file: string,
    data?: any | string,
    indexes?: {prop: string, value: number | string, type: TypeIndex}[]
}

export type TypeSetCallback = {
    key: string,
    error: Error
}

export type TypeChannelWorkerFrom =
    {type: 'message_trace', trace: string} |
    {type: 'message_debug', debug: string} |
    {type: 'message_error', error: string} |
    {type: 'state_complete'} |
    {type: 'state_change', rows: {action: 'insert' | 'delete', state: string, rows: TypeStateRow[]}[], sets: TypeSetCallback[] } |
    {type: 'get.obtain', key: string, error: Error, rows: {state: string, rows: TypeStateRow[]}[]} |
    {type: 'get.query', key: string, error: Error, rows: {state: string, rows: TypeStateRow[]}[]}

export type TypeChannelWorkerTo =
    {type: 'get.obtain', key: string, filter: TypeChannelStateFilterObtain[]} |
    {type: 'get.query', key: string, filter: TypeChannelStateFilterQuery[]} |
    {type: 'set', key: string, sets: TypeStateRowChange[]}

export type TypeChannelStateFilterObtain = {
    state: string,
    filter_path?: string,
    filter_file?: string,
    filters?: {index: string, value: string | number}[]
}

export type TypeChannelStateFilterQuery = {
    state: string,
    filter_global?: string,
    filters?: {index: string, query: string}[]
}

export type TypeStateRowChange =
    {action: 'insert', state: string, rows: {path: string, file: string, data: any | string}[]} |
    {action: 'delete', state: string, rows: {path: string, file: string}[]}

export class Env {
    readonly path_data: string
    readonly path_map: string
    readonly callback_state_change_delay: number
    readonly states: TypeEnvState[]
    callback: {
        error: boolean,
        debug: boolean,
        trace: boolean,
        state_complete: boolean,
        state_change: boolean
    }

    constructor(options: TypeOptions) {
        this.callback = {
            error: false,
            debug: false,
            trace: false,
            state_complete: false,
            state_change: false
        }

        this.path_data = path.resolve(z.dir(options.path_data))
        if (vvs.isEmptyString(this.path_data)) {
            throw new Error (`path_data cannot be empty`)
        }
        this.path_map = path.resolve(z.dir(options.path_map))
        if (vvs.isEmptyString(this.path_map)) {
            throw new Error (`path_map cannot be empty`)
        }

        this.callback_state_change_delay = (vvs.isEmpty(options.callback_state_change_delay) ? 1000 : options.callback_state_change_delay) as number
        if (this.callback_state_change_delay < 100) this.callback_state_change_delay = 100
        if (this.callback_state_change_delay > 100000) this.callback_state_change_delay = 100000

        this.states = (vvs.isEmpty(options.states) ? [] : options.states.map(m => {
            const typeData = new TypeDataHandler(m.type_data, m.type_data_showcase)
            return {
                name: m.name,
                path_data: z.dir(z.nzs(m.path_data, path.join(this.path_data, m.name))),
                path_map: z.dir(z.nzs(m.path_map, this.path_map)),
                type_data: typeData.typedata,
                type_data_showcase: typeData.typedata_showcase,
                indexes: (vvs.isEmpty(m.indexes) ? [] : m.indexes) as TypeOptionsStateIndex[]
            }
        })) as TypeEnvState[]

        this.states.forEach((state, state_idx) => {
            if (vvs.isEmptyString(state.name)) {
                throw new Error (`state #${state_idx} cannot have an empty name`)
            }

            if (vvs.equal(state.path_data, state.path_map)) {
                throw new Error (`state "${state.name}" contains same path_data and path_map: "${state.path_data}"`)
            }

            if (state.type_data !== 'json' && state.indexes.length > 0) {
                throw new Error (`state "${state.name}" with type data "${state.type_data}" can't has indexes`)
            }

            state.indexes.forEach((index, index_idx) => {
                if (vvs.isEmptyString(index.prop)) {
                    throw new Error (`in state "${state.name}" index #${index_idx} cannot have an empty prop`)
                }
                if (vvs.isEmptyString(index.type)) {
                    throw new Error (`in state "${state.name}" index "${index.prop}" cannot have an empty value`)
                }
            })
            const index_prop_doubles = vvs.duplicates(state.indexes.map(m => { return m.prop }))
            if (index_prop_doubles.length > 0) {
                throw new Error (`state "${state.name}" contains duplicate prop: "${index_prop_doubles.join('", "')}"`)
            }
        })

        this.states.forEach((state1, idx1) => {
            this.states.forEach((state2, idx2) => {
                if (idx1 === idx2) return
                if (vvs.equal(state1.path_data, state2.path_data)) {
                    throw new Error (`states "${state1.name}" and "${state2.name}" has same path_data "${state1.path_data}"`)
                }
                if (state1.path_data.length > state2.path_data.length && vvs.equal(state1.path_data.substring(0, state2.path_data.length), state2.path_data)) {
                    throw new Error (`path_data in state "${state2.name}" is part of path_data in state "${state1.name}"`)
                }
                if (state2.path_data.length > state1.path_data.length && vvs.equal(state2.path_data.substring(0, state1.path_data.length), state1.path_data)) {
                    throw new Error (`path_data in state "${state1.name}" is part of path_data in state "${state2.name}"`)
                }
                if (vvs.equal(state1.path_map, state2.path_data)) {
                    throw new Error (`state "${state1.name}" has the same path_map as states's "${state2.name}" path_data`)
                }
                if (state1.path_map.length > state2.path_data.length && vvs.equal(state1.path_map.substring(0, state2.path_data.length), state2.path_data.length)) {
                    throw new Error (`path_data in state "${state2.name}" is part of path_map in state "${state1.name}"`)
                }
                if (state2.path_data.length > state1.path_map.length && vvs.equal(state2.path_data.substring(0, state1.path_map.length), state1.path_map.length)) {
                    throw new Error (`path_map in state "${state1.name}" is part of path_data in state "${state2.name}"`)
                }
            })
        })

    }
}