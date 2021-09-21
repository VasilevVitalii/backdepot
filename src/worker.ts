import * as path from 'path'
import { workerData, parentPort } from 'worker_threads'
import { Env, TypeChannelStateFilterObtain, TypeChannelStateFilterQuery, TypeChannelWorkerFrom, TypeChannelWorkerTo, TypeOptionsStateIndex, TypeStateRow } from './index.env'
import { State } from './state'
import * as vvs from 'vv-shared'
import { deletefiles, dir, savefiles } from './z'
import { TypeDataHandler } from './typedata'

type TypeStateSet = {
    key: string,
    error: Error | undefined,
    processed: boolean,
    rows: {
        rkey: string,
        action: 'insert' | 'delete',
        state: State,
        path: string,
        file: string,
        data: string,
        watched: boolean
    }[]
}

const env = {
    parent: workerData as Env,
    states: [] as State[],
    need_send_state_change_init: true,
    state_changed: [] as {action: 'insert' | 'delete', state: string, rows: TypeStateRow[]}[],
    state_set: [] as TypeStateSet[],
}

const pp = parentPort
if (pp) {
    pp .on('message', data_raw => {
        const data = data_raw as TypeChannelWorkerTo
        if (data.type === 'get.obtain') {
            const result_rows = [] as {state: string, rows: TypeStateRow[]}[]
            let send_error = undefined as any as Error
            data.filter.forEach(filter => {
                load_state_obtain(filter, (error, rows) => {
                    if (error && !send_error) {
                        send_error = error
                    }
                    result_rows.push({state: filter.state, rows: rows})
                    if (result_rows.length >= data.filter.length) {
                        const message = {
                            type: 'get.obtain',
                            key: data.key,
                            rows: result_rows,
                            error: send_error
                        } as TypeChannelWorkerFrom
                        pp.postMessage(message)
                    }
                })
            })
        } else if (data.type === 'get.query') {
            const result_rows = [] as {state: string, rows: TypeStateRow[]}[]
            let send_error = undefined as any as Error
            data.filter.forEach(filter => {
                load_state_query(filter, (error, rows) => {
                    if (error && !send_error) {
                        send_error = error
                    }
                    result_rows.push({state: filter.state, rows: rows})
                    if (result_rows.length >= data.filter.length) {
                        const message = {
                            type: 'get.query',
                            key: data.key,
                            rows: result_rows,
                            error: send_error
                        } as TypeChannelWorkerFrom
                        pp.postMessage(message)
                    }
                })
            })
        } else if (data.type === 'set') {
            const set = {
                key: data.key,
                error: undefined,
                processed: false,
                rows: []
            } as TypeStateSet
            env.state_set.push(set)

            try {
                const channel = data.sets.map(m => {
                    return {
                        state_name: m.state,
                        state: env.states.find(f => vvs.equal(f.name, m.state)),
                        action: m.action,
                        rows: m.rows,
                    }
                })
                const no_state = channel.find(f => !f.state)
                if (no_state) {
                    set.error = new Error(`no find state with name "${no_state.state_name}"`)
                    return
                }

                let timer_wait_watcher = setTimeout(function tick() {
                    if (channel.some(f => (f.state as State).watch_queue_state() !== 'work')) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        timer_wait_watcher = setTimeout(tick, 500)
                        return
                    }

                    channel.forEach((channel_state, idx1) => {
                        channel_state.rows.forEach((channel_row, idx2) => {
                            set.rows.push({
                                rkey: `${idx1}-${idx2}`,
                                action: channel_state.action,
                                path: channel_state.action === 'insert' && vvs.isEmptyString(channel_row.path) ? '' : dir(channel_row.path),
                                file: channel_state.action === 'insert' && vvs.isEmptyString(channel_row.file) ? vvs.replaceAll(`${vvs.guid()}${vvs.guid()}${vvs.formatDate(new Date(), 10126)}`, '-', '').concat(channel_state.state.type_data.ext()) : vvs.toString(channel_row.file,''),
                                data: channel_state.action === 'insert' ? channel_state.state.type_data.savedata(channel_row['data']) : '',
                                state: channel_state.state,
                                watched: false
                            })
                        })
                    })

                    const need_delete = set.rows.filter(f => f.action === 'delete').map(m => { return {rkey: m.rkey, state: m.state, full_file_name: '', path: m.path, file: m.file, error: undefined as any as Error} })
                    need_delete.forEach(item => {
                        if (vvs.isEmptyString(item.file)) {
                            item.error = new Error ('file is empty')
                            item.error['code'] = 'ENOENT'
                        } else if (vvs.isEmptyString(item.path)) {
                            item.full_file_name = path.join(item.state.path_data, item.file)
                        } else {
                            item.full_file_name = path.join(item.state.path_data, item.path, item.file)
                        }
                    })

                    deletefiles(need_delete, 0, () => {
                        need_delete.filter(f => !vvs.isEmpty(f.error)).forEach(item => {
                            if (vvs.equal(item.error['code'], 'ENOENT')) {
                                set.rows.filter(f => f.action === 'delete' && f.rkey === item.rkey).forEach(row => {
                                    env.state_changed.push({
                                        state: row.state.name,
                                        action: 'delete',
                                        rows: [{
                                            path: row.path,
                                            file: row.file
                                        }]
                                    })
                                    row.watched = true
                                })
                            } else if (vvs.isEmpty(set.error)) {
                                set.error = item.error
                            }
                        })
                        if (!vvs.isEmpty(set.error)) {
                            return
                        }
                        savefiles(set.rows.filter(f => f.action === 'insert').map(m => { return {full_file_name: path.join(m.state.path_data, m.path, m.file), data: m.data}}), 0, error => {
                            if (error) {
                                set.error = error
                            } else {
                                set.processed = true
                            }
                        })
                    })
                }, 0)

            } catch (error) {
                set.error = error as Error
            }
        }
    })
    
    env.parent.states.forEach(state_env => {
        try {
            env.states.push( new State(
                state_env,
                work_info => {
                    if (!work_info || !work_info.time_init || !work_info.time_remap) {
                        env.need_send_state_change_init = true
                        return
                    }
                    if (env.parent.states.some(f => !env.states.some(ff => vvs.equal(ff.name, f.name)))) {
                        return
                    }
                    if (env.states.some(f => !f.work_info || !f.work_info.time_init || !f.work_info.time_remap)) {
                        return
                    }
                    if (env.parent.callback.state_complete && env.need_send_state_change_init === true) {
                        env.need_send_state_change_init = false
                        const message = {
                            type: 'state_complete'
                        } as TypeChannelWorkerFrom
                        pp.postMessage(message)
                    }
                },
                env.parent.callback.error === true ? error => {
                    const message = {
                        type: 'message_error',
                        error: `state "${state_env.name}" - ${error}`
                    } as TypeChannelWorkerFrom
                    pp.postMessage(message)
                } : undefined,
                env.parent.callback.debug === true ? debug => {
                    const message = {
                        type: 'message_debug',
                        debug: `state "${state_env.name}" - ${debug}`
                    } as TypeChannelWorkerFrom
                    pp.postMessage(message)
                } : undefined,
                env.parent.callback.trace === true ? trace => {
                    const message = {
                        type: 'message_trace',
                        trace: `state "${state_env.name}" - ${trace}`
                    } as TypeChannelWorkerFrom
                    pp.postMessage(message)
                } : undefined,
                rows => {
                    if (env.parent.callback.state_change === true) {

                        env.state_set.filter(f => !f.error).forEach(set => {
                            set.rows.filter(f => f.action === 'delete' && !f.watched && f.state.name === state_env.name).forEach(row => {
                                if (rows.some(f => vvs.equal(f.path, row.path) && vvs.equal(f.file, row.file))) {
                                    row.watched = true
                                }
                            })
                        })

                        env.state_changed.push({state: state_env.name, action: 'delete', rows: rows })
                    } else {
                        env.state_set.splice(0)
                    }
                },
                rows => {
                    if (env.parent.callback.state_change === true) {

                        env.state_set.filter(f => !f.error).forEach(set => {
                            set.rows.filter(f => f.action === 'insert' && !f.watched && f.state.name === state_env.name).forEach(row => {
                                if (rows.some(f => vvs.equal(f.path, row.path) && vvs.equal(f.file, row.file) && f.data === row.data)) {
                                    row.watched = true
                                }
                            })
                        })

                        const typedata = new TypeDataHandler(state_env.type_data, state_env.type_data_showcase)
                        rows.forEach(row => {
                            row.data =  typedata.loaddata(row.data as string)
                        })

                        env.state_changed.push({state: state_env.name, action: 'insert', rows: rows})
                    } else {
                        env.state_set.splice(0)
                    }
                }
            ))
        } catch (error) {
            console.log(error)
        }
    })

    env.states.forEach((state, state_idx) => {
        state.init(success => {
            if (success && env.states.length - 1 === state_idx) {
                let timer_state_change = setTimeout(function tick() {

                    const message_rows = env.state_changed.splice(0, env.state_changed.length)
                    const message_sets = state_set_send()

                    if (message_rows.length <= 0 && message_sets.length <= 0) {
                        timer_state_change = setTimeout(tick, env.parent.callback_state_change_delay)
                        return
                    }

                    const message = {
                        type: 'state_change',
                        rows: message_rows,
                        sets: message_sets,
                    } as TypeChannelWorkerFrom
                    pp.postMessage(message)

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    timer_state_change = setTimeout(tick, env.parent.callback_state_change_delay)
                }, env.parent.callback_state_change_delay)
            }
        })
    })
}

function load_state_obtain(channel_state: TypeChannelStateFilterObtain, callback: (error: Error | undefined, rows: TypeStateRow[]) => void) {
    try {
        const state = find_state(channel_state.state)
        const indexes = channel_state.filters ? channel_state.filters.map(m => { return {index: find_index(state, m.index), value: m.value} }) : []
        state.select_by_props(
            channel_state.filter_path,
            channel_state.filter_file,
            indexes.filter(f => f.index.type === 'string').map(m => { return {index: m.index.prop, value: m.value as string}}),
            indexes.filter(f => f.index.type === 'number').map(m => { return {index: m.index.prop, value: m.value as number}}),
            (error, rows) => {
                if (error) {
                    callback(error, [])
                } else {
                    callback(undefined, rows.map(m => { return {...m, data: state.type_data.loaddata(m.data as string) } }))
                }
            }
        )
    } catch (error) {
        callback(error as Error, [])
    }
}

function load_state_query(channel_state: TypeChannelStateFilterQuery, callback: (error: Error | undefined, rows: TypeStateRow[]) => void) {
    try {
        const state = find_state(channel_state.state)
        const indexes = channel_state.filters ? channel_state.filters.map(m => { return {index: find_index(state, m.index), query: m.query} }) : []
        state.select_by_query(
            channel_state.filter_global,
            indexes.filter(f => f.index.type === 'string').map(m => { return {index: m.index.prop, query: m.query}}),
            indexes.filter(f => f.index.type === 'number').map(m => { return {index: m.index.prop, query: m.query}}),
            // rows => {
            //     rows.forEach(row => { row.data = state.type_data.loaddata(row.data as string) })
            //     callback(undefined, rows)
            (error, rows) => {
                if (error) {
                    callback(error, [])
                } else {
                    callback(undefined, rows.map(m => { return {...m, data: state.type_data.loaddata(m.data as string) } }))
                }
            }
        )
    } catch (error) {
        callback(error as Error, [])
    }
}

function state_set_send () {
    const result = [] as TypeStateSet[]
    for (let i = env.state_set.length - 1; i >= 0; i--) {
        if (env.state_set[i].error) {
            result.push(...env.state_set.splice(i, 1))
            continue
        }
        if (env.state_set[i].processed && env.state_set[i].rows.every(f => f.watched)) {
            result.push(...env.state_set.splice(i, 1))
            continue
        }
    }
    return result.map(m => { return {key: m.key, error: m.error} })
}

function find_state(state_name: string): State {
    const state = env.states.find(f => vvs.equal(f.name, state_name))
    if (state) return state
    throw new Error (`state with name "${state_name}" is absent`)
}

function find_index(state: State, index_name: string): TypeOptionsStateIndex {
    const index = state.indexes.find(f => vvs.equal(f.prop, index_name))
    if (index) return index
    throw new Error (`in state with name "${state.name}" index with name "${index_name}" is absent`)
}