import path from 'path'
import worker_threads from 'worker_threads'

import * as fs from 'fs-extra'
import * as vvs from 'vv-shared'
import { TypeOptions, Env, TypeChannelWorkerFrom, TypeChannelWorkerTo, TypeChannelStateFilterObtain, TypeChannelStateFilterQuery, TypeStateRowChange, TypeSetCallback, TypeStateRow }  from './index.env'
export type {TypeChannelStateFilterObtain, TypeChannelStateFilterQuery, TypeStateRow, TypeStateRowChange, TypeSetCallback}

type CallbackFunctionOnError =  (error: string) => void
type CallbackFunctionOnDebug =  (debug: string) => void
type CallbackFunctionOnTrace =  (trace: string) => void
type CallbackFunctionOnStateComplete =  () => void
type CallbackFunctionOnStateChange =  (rows: {action: 'insert' | 'delete', state: string, rows: TypeStateRow[]}[], sets: TypeSetCallback[]) => void
type CallbackFunctionGet = (error: Error, rows: {state: string, rows: TypeStateRow[]}[]) => void

export interface IApp {
    /** start library */
    start(): void,
    get: {
        /** load data from states by simple filters */
        obtain(filter: TypeChannelStateFilterObtain[], callback: CallbackFunctionGet): void,
        /** load data from states with injected sql in filter */
        query(filter: TypeChannelStateFilterQuery[], callback: CallbackFunctionGet): void,
    },
    set(sets: TypeStateRowChange[], callback: (key: string) => void): void,
    callback: {
        /** for getting errors that occur when the library is running */
        //on_error: (FunctionOnError) => void,
        on_error: (callback: CallbackFunctionOnError) => void,
        /** for getting debug message that occur when the library is running */
        on_debug: (callback: CallbackFunctionOnDebug) => void
        /** for trace debug message that occur when the library is running */
        on_trace: (callback: CallbackFunctionOnTrace) => void
        /** for get actual state when lib started or rescan dirs after error watch dir */
        on_state_complete: (callback: CallbackFunctionOnStateComplete) => void
        /** when state changed (indesrt or delete) */
        on_state_change: (callback: CallbackFunctionOnStateChange) => void
    }
}

export function create(options: TypeOptions, callback?: (error: Error | undefined) => void): IApp {
    try {
        let started = false
        const env = new Env(options)

        let callback_error = undefined as any as CallbackFunctionOnError
        let callback_debug = undefined as any as CallbackFunctionOnDebug
        let callback_trace = undefined as any as CallbackFunctionOnTrace
        let callback_state_complete = undefined as any as CallbackFunctionOnStateComplete
        let callback_state_change = undefined as any as CallbackFunctionOnStateChange
        let worker: any
        const channel_queue_load_states = [] as {key: string, callback: CallbackFunctionGet}[]

        const app = {
            start: () => {
                if (started) return
                started = true

                const all_dirs = [
                    env.path_data,
                    env.path_map,
                    ...env.states.map(m => { return  m.path_data }),
                    ...env.states.map(m => { return  m.path_map }),
                ]
                all_dirs.forEach(dir => {
                    fs.ensureDirSync(dir)
                })

                worker = new worker_threads.Worker(path.join(__dirname, 'worker.import.js'), {workerData: env})
                worker.on('message', (worker_info: TypeChannelWorkerFrom) => {
                    if (worker_info.type === 'message_error' && callback_error) {
                        callback_error(worker_info.error)
                    } else if (worker_info.type === 'message_debug' && callback_debug) {
                        callback_debug(worker_info.debug)
                    } else if (worker_info.type === 'message_trace' && callback_trace) {
                        callback_trace(worker_info.trace)
                    } else if (worker_info.type === 'state_complete' && callback_state_complete ) {
                        callback_state_complete()
                    } else if (worker_info.type === 'get.obtain' || worker_info.type === 'get.query') {
                        const channel_queue_idx = channel_queue_load_states.findIndex(f => f.key === worker_info.key)
                        if (channel_queue_idx < 0) return
                        const channel_item = channel_queue_load_states.splice(channel_queue_idx, 1)
                        if (!channel_item || channel_item.length <= 0) return
                        channel_item[0].callback(worker_info.error, worker_info.rows)
                    } else if (worker_info.type === 'state_change' && callback_state_change ) {
                        callback_state_change(worker_info.rows, worker_info.sets)
                    }
                    // else if (worker_info.type === 'set') {
                    //     const channel_queue_idx = channel_queue_save_states.findIndex(f => f.key === worker_info.key)
                    //     if (channel_queue_idx < 0) return
                    //     const channel_item = channel_queue_save_states.splice(channel_queue_idx, 1)
                    //     if (!channel_item || channel_item.length <= 0) return
                    //     channel_item[0].callback(worker_info.error)
                    // }
                })
            },
            get: {
                obtain: (filter: TypeChannelStateFilterObtain[], callback: CallbackFunctionGet) => {
                    if (!worker || !filter || filter.length <= 0) {
                        callback(new Error('worker is not started or filter is empty'), [])
                        return
                    }

                    const key = `obtain.${vvs.guid()}${vvs.guid()}${vvs.formatDate(new Date(), 126)}`
                    channel_queue_load_states.push({key: key, callback: callback})

                    const message = {
                        type: 'get.obtain',
                        key: key,
                        filter: filter
                    } as TypeChannelWorkerTo
                    worker.postMessage(message)
                },
                query: (filter: TypeChannelStateFilterQuery[], callback: CallbackFunctionGet) => {
                    if (!callback) {
                        return
                    }
                    if (!worker || !filter || filter.length <= 0) {
                        callback(new Error('worker is not started or filter is empty'), [])
                        return
                    }

                    const key = `query.${vvs.guid()}${vvs.guid()}${vvs.formatDate(new Date(), 126)}`
                    channel_queue_load_states.push({key: key, callback: callback})

                    const message = {
                        type: 'get.query',
                        key: key,
                        filter: filter
                    } as TypeChannelWorkerTo
                    worker.postMessage(message)
                },
            },
            set: (sets: TypeStateRowChange[], callback: (key: string | undefined) => void) => {
                if (!worker || !sets || sets.length <= 0) {
                    if (callback) callback(undefined)
                    return
                }

                const key = vvs.replaceAll(`${vvs.guid()}${vvs.guid()}${vvs.formatDate(new Date(), 10126)}`, '-', '')

                const message = {
                    type: 'set',
                    key: key,
                    sets: sets
                } as TypeChannelWorkerTo
                worker.postMessage(message)

                callback(key)
            },
            callback: {
                on_error (callback): void {
                    env.callback.error = true
                    callback_error = callback
                },
                on_debug (callback): void {
                    env.callback.debug = true
                    callback_debug = callback
                },
                on_trace (callback): void {
                    env.callback.trace = true
                    callback_trace = callback
                },
                on_state_complete (callback): void {
                    env.callback.state_complete = true
                    callback_state_complete = callback
                },
                on_state_change (callback): void {
                    env.callback.state_change = true
                    callback_state_change = callback
                }
            }
        } as IApp

        if (typeof callback === 'function') {
            callback(undefined)
        }

        return app
    } catch (error) {
        if (typeof callback === 'function') {
            callback(error as Error)
        } else {
            throw error
        }
        return {
            start: () => {},
            get: {
                obtain: () => {},
                query: () => {},
            },
            set: () => {},
            callback: {
                on_error: () => {},
                on_debug: () => {},
                on_trace: () => {},
                on_state_complete: () => {},
                on_state_change: () => {}
            }
        }
    }
}