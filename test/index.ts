import * as fs from 'fs-extra'
import * as path from 'path'
import { save_persons, save_servers, save_logs } from './states_data'
import * as lib from '../src'
import * as test_get from './test_get'
import * as test_set from './test_set'

const path_root = path.resolve(__dirname, 'test-states')
const path_data = path.resolve(path_root, 'data' )
const path_map = path.resolve(path_root, 'map' )
const path_person = path.resolve(path_data,  'person')
const path_server = path.resolve(path_data, 'server')
const path_log1 = path.resolve(path_data,  'log1')
const path_log2 = path.resolve(path_data,  'log2')

const env = {
    exit_after_all_test: true,
    on_state_complete_count: 0,
    global_error: undefined as any as Error,
    //set_tests: [] as {id: number, key: string}[],
    on_state_change_rows: [] as {
        action: "insert" | "delete",
        state: string,
        rows: lib.TypeStateRow[]
    }[]
}

try {
    fs.emptyDirSync(path_root)
    fs.emptyDirSync(path_person)
    fs.emptyDirSync(path_server)
    fs.emptyDirSync(path_log1)
    fs.emptyDirSync(path_log2)
    save_persons(path_person)
    save_servers(path_server)
    save_logs(path_log1)
    save_logs(path_log2)

    const db = lib.create({
        path_data: path_data,
        path_map: path_map,
        callback_state_change_delay: 5000,
        states: [
            {
                name: 'person',
                type_data: 'json',
                indexes: [{prop: 'id', type: 'number'}, {prop: 'age', type: 'number'}, {prop: 'gender', type: 'string'}]
            },
            {
                name: 'server',
                type_data: 'json',
                indexes: [{prop: 'location', type: 'string'}]
            },
            {
                name: 'log1',
                type_data: 'json',
                indexes: [{prop: 'is_error', type: 'number'}, {prop: 'date', type: 'string'}]
            },
            {
                name: 'log2',
                type_data: 'json',
                indexes: [{prop: 'is_error', type: 'number'}, {prop: 'date', type: 'string'}]
            },
        ]
    }, error => {
        if (error) {
            console.warn('ERROR IN CREATE DB')
            console.warn(error)
            process.exit()
        }
    })

    db.callback.on_error(error => {
        console.warn('ERROR IN db.callback.on_error')
        console.warn(error)
    })

    db.callback.on_state_change((rows, sets) => {
        rows.forEach(row => {
            const fnd = env.on_state_change_rows.find(f => f.state === row.state && f.action === row.action)
            if (fnd) {
                fnd.rows.push(...row.rows)
            } else {
                env.on_state_change_rows.push(row)
            }
        })
        if (sets.length <= 0) {
            return
        }
        if (sets.length > 1) {
            env.global_error = new Error('on_state_change - sets.length > 1')
            return
        }

        let idx = test_set.tests.findIndex(f => f.key === sets[0].key)
        test_set.go_check(db, idx, env.on_state_change_rows.splice(0, env.on_state_change_rows.length), sets[0].error, () => {
            idx++
            test_set.go_send(db, idx)
        })
    })

    db.callback.on_state_complete(() => {
        env.on_state_complete_count++
        if (env.on_state_complete_count > 1) {
            console.warn(`on_state_complete_count > 1`)
            process.exit()
        }

        test_get.go(db, 0, () => {
            test_set.go_send(db, 0)
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

    if (env.global_error) {
        console.warn(`global_error: ${env.global_error.message}`)
        process.exit()
    }

    if (env.exit_after_all_test && test_get.tests.every(f => f.state === 'informed') && test_set.tests.every(f => f.state === 'informed')) {
        setTimeout(() => {
            process.exit()
        }, 5000)
    }
}, 1000)