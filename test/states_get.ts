import * as lib from '../src'
import { TypeChannelStateFilterObtain, TypeChannelStateFilterQuery, TypeStateRow } from '../src'
import { LogCompare, PersonCompare, ServerCompare, TypeLog, TypePerson, TypeServer } from './states_data'

export type TypeFunctionParamShared = {
    check_persons?: TypePerson[],
    check_servers?: TypeServer[],
    check_log1?: TypeLog[],
    check_log2?: TypeLog[],
}

export type TypeFunctionParam =
    (TypeFunctionParamShared & {func: 'obtain', filters: TypeChannelStateFilterObtain[] }) |
    (TypeFunctionParamShared & {func: 'query', filters: TypeChannelStateFilterQuery[] })

export function get (db: lib.IApp, params: TypeFunctionParam, callback: (error: Error | undefined) => void) {
    exec(db, params, (error, states) => {
        if (error) {
            callback(error)
            return
        }

        if (params.check_persons) {
            const check_persons = [...params.check_persons]

            const fnd_persons = states.find(f => f.state === 'person')
            if (!fnd_persons) {
                callback(new Error (`fnd_persons is empty`))
                return
            }

            console.log(params.func)
            console.log(params.func, check_persons, fnd_persons)

            for (let i = check_persons.length - 1; i >= 0; i --) {
                for (let j = fnd_persons.rows.length - 1; j >= 0; j --) {
                    const check = check_persons[i]
                    const fnd = fnd_persons.rows[j].data as TypePerson
                    if (PersonCompare(check, fnd)) {
                            check_persons.splice(i, 1)
                            fnd_persons.rows.splice(j, 1)
                        }
                }
            }

            if (check_persons.length > 0 || fnd_persons.rows.length > 0) {
                console.log(check_persons, fnd_persons.rows.map(m => { return m.data }))
                callback(new Error (`check_persons.length > 0 || fnd_persons.rows.length > 0`))
                return
            }
        }

        if (params.check_servers) {

            const check_servers = [...params.check_servers]

            const fnd_servers = states.find(f => f.state === 'server')
            if (!fnd_servers) {
                callback(new Error (`fnd_servers is empty`))
                return
            }

            for (let i = check_servers.length - 1; i >= 0; i --) {
                for (let j = fnd_servers.rows.length - 1; j >= 0; j --) {
                    const check = check_servers[i]
                    const fnd = fnd_servers.rows[j].data as TypeServer
                    if (ServerCompare(check, fnd)) {
                        check_servers.splice(i, 1)
                        fnd_servers.rows.splice(j, 1)
                    }
                }
            }

            if (check_servers.length > 0 || fnd_servers.rows.length > 0) {
                console.log(check_servers, fnd_servers)
                callback(new Error (`check_servers.length > 0 || fnd_servers.rows.length > 0`))
                return
            }
        }

        if (params.check_log1) {

            const check_logs1 = [...params.check_log1]

            const fnd_log1 = states.find(f => f.state === 'log1')
            if (!fnd_log1) {
                callback(new Error (`fnd_log1 is empty`))
                return
            }

            for (let i = check_logs1.length - 1; i >= 0; i --) {
                for (let j = fnd_log1.rows.length - 1; j >= 0; j --) {
                    const check = check_logs1[i]
                    const fnd = fnd_log1.rows[j].data as TypeLog
                    if (LogCompare(check, fnd)) {
                        check_logs1.splice(i, 1)
                        fnd_log1.rows.splice(j, 1)
                    }
                }
            }

            if (check_logs1.length > 0 || fnd_log1.rows.length > 0) {
                console.log(check_logs1, fnd_log1)
                callback(new Error (`check_logs1.length > 0 || fnd_log1.rows.length > 0`))
                return
            }
        }

        if (params.check_log2) {

            const check_logs2 = [...params.check_log2]

            const fnd_log2 = states.find(f => f.state === 'log2')
            if (!fnd_log2) {
                callback(new Error (`fnd_log2 is empty`))
                return
            }

            for (let i = check_logs2.length - 1; i >= 0; i --) {
                for (let j = fnd_log2.rows.length - 1; j >= 0; j --) {
                    const check = check_logs2[i]
                    const fnd = fnd_log2.rows[j].data as TypeLog
                    if (LogCompare(check, fnd)) {
                        check_logs2.splice(i, 1)
                        fnd_log2.rows.splice(j, 1)
                    }
                }
            }

            if (check_logs2.length > 0 || fnd_log2.rows.length > 0) {
                console.log(check_logs2, fnd_log2)
                callback(new Error (`check_logs2.length > 0 || fnd_log2.rows.length > 0`))
                return
            }
        }

        callback(undefined)
    })
}

function exec (db: lib.IApp, params: TypeFunctionParam, callback: (error: Error, states: {state: string, rows: TypeStateRow[]}[]) => void) {
    if (params.func === 'query') {
        db.get.query(params.filters, callback)
    } else if (params.func === 'obtain') {
        db.get.obtain(params.filters, callback)
    } else {
        callback(new Error (`unknown params.func`), [])
    }
}


