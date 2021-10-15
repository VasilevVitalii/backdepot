import * as fs from 'fs-extra'
import * as path from 'path'
import { SavePersons, SaveServers, SaveLogs } from './states_data'
import * as lib from '../src'
import * as test_get from './test_get'
import * as test_set from './test_set'

const pathRoot = path.resolve(__dirname, 'test-states')
const pathData = path.resolve(pathRoot, 'data' )
const pathMap = path.resolve(pathRoot, 'map' )
const pathPerson = path.resolve(pathData,  'person')
const pathServer = path.resolve(pathData, 'server')
const pathLog1 = path.resolve(pathData,  'log1')
const pathLog2 = path.resolve(pathData,  'log2')

const env = {
    allowExitAfterAllTest: true,
    isInMemory: false,
    onStateCompleteCount: 0,
    globalError: undefined as any as Error,
    //set_tests: [] as {id: number, key: string}[],
    onStateChangeRows: [] as {
        action: "insert" | "delete",
        state: string,
        rows: lib.TypeStateRow[]
    }[]
}

try {
    fs.emptyDirSync(pathRoot)
    fs.emptyDirSync(pathPerson)
    fs.emptyDirSync(pathServer)
    fs.emptyDirSync(pathLog1)
    fs.emptyDirSync(pathLog2)
    SavePersons(pathPerson)
    SaveServers(pathServer)
    SaveLogs(pathLog1)
    SaveLogs(pathLog2)

    const db = lib.Create({
        pathData: pathData,
        pathMap: 'MEMORY', //pathMap,
        callbackStateChangeDelay: 5000,
        states: [
            {
                name: 'person',
                typeData: 'json',
                indexes: [{prop: 'id', type: 'number'}, {prop: 'age', type: 'number'}, {prop: 'gender', type: 'string'}]
            },
            {
                name: 'server',
                typeData: 'json',
                indexes: [{prop: 'location', type: 'string'}]
            },
            {
                name: 'log1',
                typeData: 'json',
                indexes: [{prop: 'isError', type: 'number'}, {prop: 'date', type: 'string'}]
            },
            {
                name: 'log2',
                typeData: 'json',
                indexes: [{prop: 'isError', type: 'number'}, {prop: 'date', type: 'string'}]
            },
        ]
    }, error => {
        if (error) {
            console.warn('ERROR IN CREATE DB')
            console.warn(error)
            process.exit()
        }
    })

    db.callback.onError(error => {
        console.warn('ERROR IN db.callback.on_error')
        console.warn(error)
    })

    db.callback.onStateChange((rows, sets) => {
        rows.forEach(row => {
            const fnd = env.onStateChangeRows.find(f => f.state === row.state && f.action === row.action)
            if (fnd) {
                fnd.rows.push(...row.rows)
            } else {
                env.onStateChangeRows.push(row)
            }
        })
        if (sets.length <= 0) {
            return
        }
        if (sets.length > 1) {
            env.globalError = new Error('on_state_change - sets.length > 1')
            return
        }

        let idx = test_set.tests.findIndex(f => f.key === sets[0].key)
        test_set.GoCheck(db, idx, env.onStateChangeRows.splice(0, env.onStateChangeRows.length), sets[0].error, () => {
            idx++
            test_set.GoSend(db, idx)
        })
    })

    db.callback.onStateComplete(() => {
        env.onStateCompleteCount++
        if (env.onStateCompleteCount > 1) {
            console.warn(`on_state_complete_count > 1`)
            process.exit()
        }

        test_get.Go(db, 0, () => {
            test_set.GoSend(db, 0)
        })
    })

    db.start()

} catch (error) {
    console.warn(error)
}

setInterval(() => {
    test_get.tests.filter(f => f.state !== 'waiting' && f.state !== 'informed').forEach(test => {
        if (test.state === 'processed') {
            if (test.error) {
                console.warn(`test-get.${test.name}: failed - ${test.error.message}`)
            } else {
                console.log(`test-get.${test.name}: passed`)
            }
        } else {
            console.warn(`test-get.${test.name}: ${test.state}`)
        }
        test.state = 'informed'
    })

    test_set.tests.filter(f => f.state !== 'waiting' && f.state !== 'informed').forEach(test => {
        if (test.state === 'processed') {
            if (test.error) {
                console.warn(`test-set.${test.name}: failed - ${test.error.message}`)
            } else {
                console.log(`test-set.${test.name}: passed`)
            }
        } else {
            console.warn(`test-set.${test.name}: ${test.state}`)
        }
        test.state = 'informed'
    })

    if (env.globalError) {
        console.warn(`global_error: ${env.globalError.message}`)
        process.exit()
    }

    if (env.allowExitAfterAllTest && test_get.tests.every(f => f.state === 'informed') && test_set.tests.every(f => f.state === 'informed')) {
        setTimeout(() => {
            process.exit()
        }, 5000)
    }
}, 1000)