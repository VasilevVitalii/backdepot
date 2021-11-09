import path from 'path'
import worker_threads from 'worker_threads'

import * as fs from 'fs-extra'
import * as vv from 'vv-common'
import { TOptions, Env, TChannelWorkerFrom, TChannelWorkerTo, TChannelStateFilterObtain, TChannelStateFilterQuery, TStateRowChange, TSetCallback, TStateRow }  from './index.env'
import { setTimeout } from 'timers'
export type {TChannelStateFilterObtain as TypeChannelStateFilterObtain, TChannelStateFilterQuery as TypeChannelStateFilterQuery, TStateRow as TypeStateRow, TStateRowChange as TypeStateRowChange, TSetCallback as TypeSetCallback}

type TCallbackFunctionOnError =  (error: string) => void
type TCallbackFunctionOnDebug =  (debug: string) => void
type TCallbackFunctionOnTrace =  (trace: string) => void
type TCallbackFunctionOnStateComplete =  () => void
type TCallbackFunctionOnStateChange =  (rows: {action: 'insert' | 'delete', state: string, rows: TStateRow[]}[], sets: TSetCallback[]) => void
type TCallbackFunctionGet = (error: Error, rows: {state: string, rows: TStateRow[]}[]) => void

export interface IApp {
    /** start library */
    start(): void,
    get: {
        /** load data from states by simple filters */
        obtain(filter: TChannelStateFilterObtain[], callback: TCallbackFunctionGet): void,
        /** load data from states with injected sql in filter */
        query(filter: TChannelStateFilterQuery[], callback: TCallbackFunctionGet): void,
    },
    set(sets: TStateRowChange[], callback: (key: string) => void): void,
    callback: {
        /** for getting errors that occur when the library is running */
        //on_error: (FunctionOnError) => void,
        onError: (callback: TCallbackFunctionOnError) => void,
        /** for getting debug message that occur when the library is running */
        onDebug: (callback: TCallbackFunctionOnDebug) => void
        /** for trace debug message that occur when the library is running */
        onTrace: (callback: TCallbackFunctionOnTrace) => void
        /** for get actual state when lib started or rescan dirs after error watch dir */
        onStateComplete: (callback: TCallbackFunctionOnStateComplete) => void
        /** when state changed (indesrt or delete) */
        onStateChange: (callback: TCallbackFunctionOnStateChange) => void
    }
}

export function Create(options: TOptions, callback?: (error: Error | undefined) => void): IApp {
    try {
        let isStarted = false
        const env = new Env(options)

        let callbackError = undefined as any as TCallbackFunctionOnError
        let callbackDebug = undefined as any as TCallbackFunctionOnDebug
        let callbackTrace = undefined as any as TCallbackFunctionOnTrace
        let callbackStateComplete = undefined as any as TCallbackFunctionOnStateComplete
        let callbackStateChange = undefined as any as TCallbackFunctionOnStateChange
        let worker: any
        const channelQueueLoadStates = [] as {key: string, callback: TCallbackFunctionGet}[]

        const app = {
            start: () => {
                if (isStarted) return
                isStarted = true

                const allDirs = [
                    env.pathData,
                    env.pathMap,
                    ...env.states.map(m => { return  m.pathData }),
                    ...env.states.map(m => { return  m.pathMap }),
                ]
                allDirs.filter(f => f !== 'MEMORY').forEach(dir => {
                    fs.ensureDirSync(dir)
                })

                worker = new worker_threads.Worker(path.join(__dirname, 'worker.js'), {workerData: env})
                worker.on('message', (workerInfo: TChannelWorkerFrom) => {
                    if (workerInfo.type === 'message_error' && callbackError) {
                        callbackError(workerInfo.error)
                    } else if (workerInfo.type === 'message_debug' && callbackDebug) {
                        callbackDebug(workerInfo.debug)
                    } else if (workerInfo.type === 'message_trace' && callbackTrace) {
                        callbackTrace(workerInfo.trace)
                    } else if (workerInfo.type === 'state_complete' && callbackStateComplete ) {
                        setTimeout(() => { callbackStateComplete() }, 0)
                    } else if (workerInfo.type === 'get.obtain' || workerInfo.type === 'get.query') {
                        const channelQueueIdx = channelQueueLoadStates.findIndex(f => f.key === workerInfo.key)
                        if (channelQueueIdx < 0) return
                        const channelItem = channelQueueLoadStates.splice(channelQueueIdx, 1)
                        if (!channelItem || channelItem.length <= 0) return
                        channelItem[0].callback(workerInfo.error, workerInfo.rows)
                    } else if (workerInfo.type === 'state_change' && callbackStateChange ) {
                        setTimeout(() => { callbackStateChange(workerInfo.rows, workerInfo.sets) }, 0)
                    }
                })
            },
            get: {
                obtain: (filter: TChannelStateFilterObtain[], callback: TCallbackFunctionGet) => {
                    if (!worker || !filter || filter.length <= 0) {
                        callback(new Error('worker is not started or filter is empty'), [])
                        return
                    }

                    const key = `obtain.${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), '126')}`
                    channelQueueLoadStates.push({key: key, callback: callback})

                    const message = {
                        type: 'get.obtain',
                        key: key,
                        filter: filter
                    } as TChannelWorkerTo
                    worker.postMessage(message)
                },
                query: (filter: TChannelStateFilterQuery[], callback: TCallbackFunctionGet) => {
                    if (!callback) {
                        return
                    }
                    if (!worker || !filter || filter.length <= 0) {
                        callback(new Error('worker is not started or filter is empty'), [])
                        return
                    }

                    const key = `query.${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), '126')}`
                    channelQueueLoadStates.push({key: key, callback: callback})

                    const message = {
                        type: 'get.query',
                        key: key,
                        filter: filter
                    } as TChannelWorkerTo
                    worker.postMessage(message)
                },
            },
            set: (sets: TStateRowChange[], callback: (key: string | undefined) => void) => {
                if (!worker || !sets || sets.length <= 0) {
                    if (callback) callback(undefined)
                    return
                }

                const key = `${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), 'yyyymmddhhmissmsec')}`

                const message = {
                    type: 'set',
                    key: key,
                    sets: sets
                } as TChannelWorkerTo
                worker.postMessage(message)

                callback(key)
            },
            callback: {
                onError (callback): void {
                    env.callback.allowError = true
                    callbackError = callback
                },
                onDebug (callback): void {
                    env.callback.allowDebug = true
                    callbackDebug = callback
                },
                onTrace (callback): void {
                    env.callback.allowTrace = true
                    callbackTrace = callback
                },
                onStateComplete (callback): void {
                    env.callback.isStateComplete = true
                    callbackStateComplete = callback
                },
                onStateChange (callback): void {
                    env.callback.isStateChange = true
                    callbackStateChange = callback
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
                onError: () => {},
                onDebug: () => {},
                onTrace: () => {},
                onStateComplete: () => {},
                onStateChange: () => {}
            }
        }
    }
}