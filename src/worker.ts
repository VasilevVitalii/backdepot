import * as path from 'path'
import { workerData, parentPort } from 'worker_threads'
import { Env, TChannelStateFilterObtain, TChannelStateFilterQuery, TChannelWorkerFrom, TChannelWorkerTo, TOptionsStateIndex, TStateRow } from './index.env'
import { State } from './state/index'
import * as vv from 'vv-common'
import { DeleteFiles, Dir, SaveFiles } from './z'
import { TypeDataHandler } from './typedata'

type TStateSet = {
    key: string,
    error: Error | undefined,
    isProcessed: boolean,
    rows: {
        rkey: string,
        action: 'insert' | 'delete',
        state: State,
        path: string,
        file: string,
        data: string,
        isWatched: boolean
    }[]
}

const env = {
    parent: workerData as Env,
    states: [] as State[],
    needSendStateChangeInit: true,
    stateChanged: [] as {action: 'insert' | 'delete', state: string, rows: TStateRow[]}[],
    stateSet: [] as TStateSet[],
}

const pp = parentPort
if (pp) {
    pp .on('message', dataRaw => {
        const data = dataRaw as TChannelWorkerTo
        if (data.type === 'get.obtain') {
            const resultRows = [] as {state: string, rows: TStateRow[]}[]
            let sendError = undefined as any as Error
            data.filter.forEach(filter => {
                loadStateObtain(filter, (error, rows) => {
                    if (error && !sendError) {
                        sendError = error
                    }
                    resultRows.push({state: filter?.state, rows: rows})
                    if (resultRows.length >= data.filter.length) {
                        const message = {
                            type: 'get.obtain',
                            key: data.key,
                            rows: resultRows,
                            error: sendError
                        } as TChannelWorkerFrom
                        pp.postMessage(message)
                    }
                })
            })
        } else if (data.type === 'get.query') {
            const resultRows = [] as {state: string, rows: TStateRow[]}[]
            let sendError = undefined as any as Error
            data.filter.forEach(filter => {
                loadStateQuery(filter, (error, rows) => {
                    if (error && !sendError) {
                        sendError = error
                    }
                    resultRows.push({state: filter.state, rows: rows})
                    if (resultRows.length >= data.filter.length) {
                        const message = {
                            type: 'get.query',
                            key: data.key,
                            rows: resultRows,
                            error: sendError
                        } as TChannelWorkerFrom
                        pp.postMessage(message)
                    }
                })
            })
        } else if (data.type === 'set') {
            const set = {
                key: data.key,
                error: undefined,
                isProcessed: false,
                rows: []
            } as TStateSet
            env.stateSet.push(set)

            try {
                const channel = data.sets.map(m => {
                    return {
                        stateName: m.state,
                        state: env.states.find(f => vv.equal(f.name, m.state)),
                        action: m.action,
                        rows: m.rows,
                    }
                })
                const noState = channel.find(f => !f.state)
                if (noState) {
                    set.error = new Error(`no find state with name "${noState.stateName}"`)
                    return
                }

                let timerWaitWatcher = setTimeout(function tick() {
                    if (channel.some(f => (f.state as State).watchQueueState() !== 'work')) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        timerWaitWatcher = setTimeout(tick, 500)
                        return
                    }

                    channel.forEach((channelState, idx1) => {
                        channelState.rows.forEach((channelRow, idx2) => {
                            set.rows.push({
                                rkey: `${idx1}-${idx2}`,
                                action: channelState.action,
                                path: channelState.action === 'insert' && vv.isEmpty(channelRow.path) ? '' : Dir(channelRow.path),
                                file: channelState.action === 'insert' && vv.isEmpty(channelRow.file) ? `${vv.guid()}${vv.guid()}${vv.dateFormat(new Date(), 'yyyymmddhhmissmsec')}`.concat(channelState.state.typeData.ext()) : vv.nz(vv.toString(channelRow.file), ''),
                                data: channelState.action === 'insert' ? channelState.state.typeData.savedata(channelRow['data']) : '',
                                state: channelState.state,
                                isWatched: false
                            })
                        })
                    })

                    const needDelete = set.rows.filter(f => f.action === 'delete').map(m => { return {rkey: m.rkey, state: m.state, fullFileName: '', path: m.path, file: m.file, error: undefined as any as Error} })
                    needDelete.forEach(item => {
                        if (vv.isEmpty(item.file)) {
                            item.error = new Error ('file is empty')
                            item.error['code'] = 'ENOENT'
                        } else if (vv.isEmpty(item.path)) {
                            item.fullFileName = path.join(item.state.pathData, item.file)
                        } else {
                            item.fullFileName = path.join(item.state.pathData, item.path, item.file)
                        }
                    })

                    DeleteFiles(needDelete, 0, () => {
                        needDelete.filter(f => !vv.isEmpty(f.error)).forEach(item => {
                            if (vv.equal(item.error['code'], 'ENOENT')) {
                                set.rows.filter(f => f.action === 'delete' && f.rkey === item.rkey).forEach(row => {
                                    env.stateChanged.push({
                                        state: row.state.name,
                                        action: 'delete',
                                        rows: [{
                                            path: row.path,
                                            file: row.file
                                        }]
                                    })
                                    row.isWatched = true
                                })
                            } else if (vv.isEmpty(set.error)) {
                                set.error = item.error
                            }
                        })
                        if (!vv.isEmpty(set.error)) {
                            return
                        }
                        SaveFiles(set.rows.filter(f => f.action === 'insert').map(m => { return {fullFileName: path.join(m.state.pathData, m.path, m.file), data: m.data}}), 0, error => {
                            if (error) {
                                set.error = error
                            } else {
                                set.isProcessed = true
                            }
                        })
                    })
                }, 0)

            } catch (error) {
                set.error = error as Error
            }
        }
    })

    env.parent.states.forEach(stateEnv => {
        try {
            env.states.push( new State(
                stateEnv,
                workInfo => {
                    if (!workInfo || !workInfo.timeInit || !workInfo.timeRemap) {
                        env.needSendStateChangeInit = true
                        return
                    }
                    if (env.parent.states.some(f => !env.states.some(ff => vv.equal(ff.name, f.name)))) {
                        return
                    }
                    if (env.states.some(f => !f.workInfo || !f.workInfo.time_init || !f.workInfo.time_remap)) {
                        return
                    }
                    if (env.parent.callback.isStateComplete && env.needSendStateChangeInit === true) {
                        env.needSendStateChangeInit = false
                        const message = {
                            type: 'state_complete'
                        } as TChannelWorkerFrom
                        pp.postMessage(message)
                    }
                },
                env.parent.callback.allowError === true ? error => {
                    const message = {
                        type: 'message_error',
                        error: `state "${stateEnv.name}" - ${error}`
                    } as TChannelWorkerFrom
                    pp.postMessage(message)
                } : undefined,
                env.parent.callback.allowDebug === true ? debug => {
                    const message = {
                        type: 'message_debug',
                        debug: `state "${stateEnv.name}" - ${debug}`
                    } as TChannelWorkerFrom
                    pp.postMessage(message)
                } : undefined,
                env.parent.callback.allowTrace === true ? trace => {
                    const message = {
                        type: 'message_trace',
                        trace: `state "${stateEnv.name}" - ${trace}`
                    } as TChannelWorkerFrom
                    pp.postMessage(message)
                } : undefined,
                rows => {
                    if (env.parent.callback.isStateChange === true) {

                        env.stateSet.filter(f => !f.error).forEach(set => {
                            set.rows.filter(f => f.action === 'delete' && !f.isWatched && f.state.name === stateEnv.name).forEach(row => {
                                if (rows.some(f => vv.equal(f.path, row.path) && vv.equal(f.file, row.file))) {
                                    row.isWatched = true
                                }
                            })
                        })

                        env.stateChanged.push({state: stateEnv.name, action: 'delete', rows: rows })
                    } else {
                        env.stateSet.splice(0)
                    }
                },
                rows => {
                    if (env.parent.callback.isStateChange === true) {

                        env.stateSet.filter(f => !f.error).forEach(set => {
                            set.rows.filter(f => f.action === 'insert' && !f.isWatched && f.state.name === stateEnv.name).forEach(row => {
                                if (rows.some(f => vv.equal(f.path, row.path) && vv.equal(f.file, row.file) && f.data === row.data)) {
                                    row.isWatched = true
                                }
                            })
                        })

                        const typedata = new TypeDataHandler(stateEnv.typeData, stateEnv.typeDataShowcase)
                        rows.forEach(row => {
                            row.data =  typedata.loaddata(row.data as string)
                        })

                        env.stateChanged.push({state: stateEnv.name, action: 'insert', rows: rows})
                    } else {
                        env.stateSet.splice(0)
                    }
                }
            ))
        } catch (error) {
            console.log(error)
        }
    })

    env.states.forEach((state, stateIdx) => {
        state.init(isSuccess => {
            if (isSuccess && env.states.length - 1 === stateIdx) {
                let timerStateChange = setTimeout(function tick() {

                    const messageRows = env.stateChanged.splice(0, env.stateChanged.length)
                    const messageSets = stateSetSend()

                    if (messageRows.length <= 0 && messageSets.length <= 0) {
                        timerStateChange = setTimeout(tick, env.parent.callbackStateChangeDelay)
                        return
                    }

                    const message = {
                        type: 'state_change',
                        rows: messageRows,
                        sets: messageSets,
                    } as TChannelWorkerFrom
                    pp.postMessage(message)

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    timerStateChange = setTimeout(tick, env.parent.callbackStateChangeDelay)
                }, env.parent.callbackStateChangeDelay)
            }
        })
    })
}

function loadStateObtain(channelState: TChannelStateFilterObtain, callback: (error: Error | undefined, rows: TStateRow[]) => void) {
    try {
        if (!channelState || !channelState.state) {
            callback(undefined, [])
            return
        }
        const state = findState(channelState.state)
        const indexes = channelState.filters ? channelState.filters.map(m => { return {index: findIndex(state, m.index), value: m.value} }) : []
        state.selectByProps(
            channelState.filterPath,
            channelState.filterFile,
            indexes.filter(f => f.index.type === 'string').map(m => { return {index: m.index.prop, value: m.value as string}}),
            indexes.filter(f => f.index.type === 'number').map(m => { return {index: m.index.prop, value: m.value as number}}),
            (error, rows) => {
                if (error) {
                    callback(error, [])
                } else {
                    callback(undefined, rows.map(m => { return {...m, data: state.typeData.loaddata(m.data as string) } }))
                }
            }
        )
    } catch (error) {
        callback(error as Error, [])
    }
}

function loadStateQuery(channelState: TChannelStateFilterQuery, callback: (error: Error | undefined, rows: TStateRow[]) => void) {
    try {
        const state = findState(channelState.state)
        const indexes = channelState.filters ? channelState.filters.map(m => { return {index: findIndex(state, m.index), query: m.query} }) : []
        state.selectByQuery(
            channelState.filterGlobal,
            indexes.filter(f => f.index.type === 'string').map(m => { return {index: m.index.prop, query: m.query}}),
            indexes.filter(f => f.index.type === 'number').map(m => { return {index: m.index.prop, query: m.query}}),
            (error, rows) => {
                if (error) {
                    callback(error, [])
                } else {
                    callback(undefined, rows.map(m => { return {...m, data: state.typeData.loaddata(m.data as string) } }))
                }
            }
        )
    } catch (error) {
        callback(error as Error, [])
    }
}

function stateSetSend () {
    const result = [] as TStateSet[]
    for (let i = env.stateSet.length - 1; i >= 0; i--) {
        if (env.stateSet[i].error) {
            result.push(...env.stateSet.splice(i, 1))
            continue
        }
        if (env.stateSet[i].isProcessed && env.stateSet[i].rows.every(f => f.isWatched)) {
            result.push(...env.stateSet.splice(i, 1))
            continue
        }
    }
    return result.map(m => { return {key: m.key, error: m.error} })
}

function findState(stateName: string): State {
    const state = env.states.find(f => vv.equal(f.name, stateName))
    if (state) return state
    throw new Error (`state with name "${stateName}" is absent`)
}

function findIndex(state: State, indexName: string): TOptionsStateIndex {
    const index = state.indexes.find(f => vv.equal(f.prop, indexName))
    if (index) return index
    throw new Error (`in state with name "${state.name}" index with name "${indexName}" is absent`)
}