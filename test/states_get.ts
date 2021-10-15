import * as lib from '../src'
import { TypeChannelStateFilterObtain, TypeChannelStateFilterQuery, TypeStateRow } from '../src'
import { LogCompare, PersonCompare, ServerCompare, TLog, TPerson, TServer } from './states_data'

export type TFunctionParamShared = {
    checkPersons?: TPerson[],
    checkServers?: TServer[],
    checkLog1?: TLog[],
    checkLog2?: TLog[],
}

export type TFunctionParam =
    (TFunctionParamShared & {func: 'obtain', filters: TypeChannelStateFilterObtain[] }) |
    (TFunctionParamShared & {func: 'query', filters: TypeChannelStateFilterQuery[] })

export function Get (db: lib.IApp, params: TFunctionParam, callback: (error: Error | undefined) => void) {
    exec(db, params, (error, states) => {
        if (error) {
            callback(error)
            return
        }

        if (params.checkPersons) {
            const checkPersons = [...params.checkPersons]

            const fndPersons = states.find(f => f.state === 'person')
            if (!fndPersons) {
                callback(new Error (`fnd_persons is empty`))
                return
            }

            for (let i = checkPersons.length - 1; i >= 0; i --) {
                for (let j = fndPersons.rows.length - 1; j >= 0; j --) {
                    const check = checkPersons[i]
                    const fnd = fndPersons.rows[j].data as TPerson
                    if (PersonCompare(check, fnd)) {
                            checkPersons.splice(i, 1)
                            fndPersons.rows.splice(j, 1)
                        }
                }
            }

            if (checkPersons.length > 0 || fndPersons.rows.length > 0) {
                console.log(checkPersons, fndPersons.rows.map(m => { return m.data }))
                callback(new Error (`check_persons.length > 0 || fnd_persons.rows.length > 0`))
                return
            }
        }

        if (params.checkServers) {

            const checkServers = [...params.checkServers]

            const fndServers = states.find(f => f.state === 'server')
            if (!fndServers) {
                callback(new Error (`fnd_servers is empty`))
                return
            }

            for (let i = checkServers.length - 1; i >= 0; i --) {
                for (let j = fndServers.rows.length - 1; j >= 0; j --) {
                    const check = checkServers[i]
                    const fnd = fndServers.rows[j].data as TServer
                    if (ServerCompare(check, fnd)) {
                        checkServers.splice(i, 1)
                        fndServers.rows.splice(j, 1)
                    }
                }
            }

            if (checkServers.length > 0 || fndServers.rows.length > 0) {
                console.log(checkServers, fndServers)
                callback(new Error (`check_servers.length > 0 || fnd_servers.rows.length > 0`))
                return
            }
        }

        if (params.checkLog1) {

            const checkLogs1 = [...params.checkLog1]

            const fndLog1 = states.find(f => f.state === 'log1')
            if (!fndLog1) {
                callback(new Error (`fnd_log1 is empty`))
                return
            }

            for (let i = checkLogs1.length - 1; i >= 0; i --) {
                for (let j = fndLog1.rows.length - 1; j >= 0; j --) {
                    const check = checkLogs1[i]
                    const fnd = fndLog1.rows[j].data as TLog
                    if (LogCompare(check, fnd)) {
                        checkLogs1.splice(i, 1)
                        fndLog1.rows.splice(j, 1)
                    }
                }
            }

            if (checkLogs1.length > 0 || fndLog1.rows.length > 0) {
                console.log(checkLogs1, fndLog1)
                callback(new Error (`check_logs1.length > 0 || fnd_log1.rows.length > 0`))
                return
            }
        }

        if (params.checkLog2) {

            const checkLogs2 = [...params.checkLog2]

            const fndLog2 = states.find(f => f.state === 'log2')
            if (!fndLog2) {
                callback(new Error (`fnd_log2 is empty`))
                return
            }

            for (let i = checkLogs2.length - 1; i >= 0; i --) {
                for (let j = fndLog2.rows.length - 1; j >= 0; j --) {
                    const check = checkLogs2[i]
                    const fnd = fndLog2.rows[j].data as TLog
                    if (LogCompare(check, fnd)) {
                        checkLogs2.splice(i, 1)
                        fndLog2.rows.splice(j, 1)
                    }
                }
            }

            if (checkLogs2.length > 0 || fndLog2.rows.length > 0) {
                console.log(checkLogs2, fndLog2)
                callback(new Error (`check_logs2.length > 0 || fnd_log2.rows.length > 0`))
                return
            }
        }

        callback(undefined)
    })
}

function exec (db: lib.IApp, params: TFunctionParam, callback: (error: Error, states: {state: string, rows: TypeStateRow[]}[]) => void) {
    if (params.func === 'query') {
        db.get.query(params.filters, callback)
    } else if (params.func === 'obtain') {
        db.get.obtain(params.filters, callback)
    } else {
        callback(new Error (`unknown params.func`), [])
    }
}


