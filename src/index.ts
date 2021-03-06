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
    set(sets: TStateRowChange[], callback?: (key: string, error: Error) => void): void,
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
        const callbackStateSets = [] as {key: string, callback: (key: string, error: Error) => void}[]

        let worker: any
        const channelQueueLoadStates = [] as {key: string, callback: TCallbackFunctionGet}[]

        const app: IApp = {
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
                    } else if (workerInfo.type === 'state_change' ) {
                        if (workerInfo.sets) {
                            for (let i = 0; i < workerInfo.sets.length; i++) {
                                const item = workerInfo.sets[i]
                                const findIdx = callbackStateSets.findIndex(f => f.key === item.key)
                                if (findIdx >= 0) {
                                    callbackStateSets[findIdx].callback(item.key, item.error)
                                    callbackStateSets.splice(findIdx, 1)
                                    break
                                }
                            }
                        }
                        if (callbackStateChange) {
                            setTimeout(() => { callbackStateChange(workerInfo.rows, workerInfo.sets) }, 0)
                        }
                    }
                })
            },
            get: {
                obtain: (filter: TChannelStateFilterObtain[], callback: TCallbackFunctionGet) => {
                    if (!worker) {
                        callback(new Error('worker is not started'), [])
                        return
                    }
                    if (!filter || filter.length <= 0) {
                        callback(undefined, [])
                        return
                    }

                    const key = `obtain.${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), '126')}`
                    channelQueueLoadStates.push({key: key, callback: callback})

                    const message: TChannelWorkerTo = {
                        type: 'get.obtain',
                        key: key,
                        filter: filter
                    }
                    worker.postMessage(message)
                },
                query: (filter: TChannelStateFilterQuery[], callback: TCallbackFunctionGet) => {
                    if (!worker) {
                        callback(new Error('worker is not started'), [])
                        return
                    }
                    if (!filter || filter.length <= 0) {
                        callback(undefined, [])
                        return
                    }

                    const key = `query.${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), '126')}`
                    channelQueueLoadStates.push({key: key, callback: callback})

                    const message: TChannelWorkerTo = {
                        type: 'get.query',
                        key: key,
                        filter: filter
                    }
                    worker.postMessage(message)
                },
            },
            set: (sets: TStateRowChange[], callback?: (key: string, error: Error) => void) => {
                if (!worker || !sets || sets.length <= 0 || sets.every(f => f.rows.length <= 0)) {
                    if (callback) callback(undefined, undefined)
                    return
                }
                const key = `${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), 'yyyymmddhhmissmsec')}`

                if (callback) {
                    callbackStateSets.push({key: key, callback: callback})
                }

                const message: TChannelWorkerTo = {
                    type: 'set',
                    key: key,
                    sets: sets
                }
                worker.postMessage(message)
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
                    callbackStateChange = callback
                }
            }
        }

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