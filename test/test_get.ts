import { logs, persons, servers } from './states_data'
import * as lib from '../src'
import { get, TypeFunctionParam } from './states_get'

type TypeTest = {
    name: string,
    state: 'waiting' | 'processed' | 'informed',
    func_params: TypeFunctionParam,
    error?: Error,
}

export const tests = [
    {
        name: 'obtain-all',
        state: 'waiting',
        func_params: {
            func: 'obtain',
            check_persons: persons,
            check_servers: servers,
            check_log1: logs,
            check_log2: logs,
            filters: [{state: 'person'}, {state: 'server'}, {state: 'log1'}, {state: 'log2'}]
        }
    },
    {
        name: 'obtain-filter',
        state: 'waiting',
        func_params: {
            func: 'obtain',
            check_persons: persons.filter(f => f.id === 101 && f.gender === 'woman'),
            check_servers: servers.filter(f => f.location === 'xxx'),
            check_log1: logs.filter(f => f.is_error === true),
            check_log2: logs.filter(f => f.is_error === false),
            filters: [
                {state: 'person', filters: [{index: 'id', value: '101'}, {index: 'gender', value: 'woman'}]},
                {state: 'server', filters: [{index: 'location', value: 'xxx'}]},
                {state: 'log1', filters: [{index: 'is_error', value: '1'}]},
                {state: 'log2', filters: [{index: 'is_error', value: '0'}]},
            ]
        }
    },
    {
        name: 'query-all',
        state: 'waiting',
        func_params: {
            func: 'query',
            check_persons: persons,
            check_servers: servers,
            check_log1: logs,
            check_log2: logs,
            filters: [{state: 'person'}, {state: 'server'}, {state: 'log1'}, {state: 'log2'}]
        }
    },
    {
        name: 'query-filter',
        state: 'waiting',
        func_params: {
            func: 'query',
            check_persons: persons.filter(f => f.id > 101),
            check_servers: servers.filter(f => !f.location),
            check_log1: logs.filter(f => f.is_error === true),
            check_log2: logs.filter(f => f.is_error === false),
            filters: [
                {state: 'person', filter_global: "$path <> 'aaa'", filters: [{index: 'id', query: '$value > 101'}, {index: 'gender', query: '$value is not null'}]},
                {state: 'server', filters: [{index: 'location', query: '$value IS NULL'}]},
                {state: 'log1', filters: [{index: 'is_error', query: '$value = 1'}]},
                {state: 'log2', filters: [{index: 'is_error', query: '$value = 0'}]},
            ],
        }
    }
] as TypeTest[]

export function go(db: lib.IApp, idx: number, callback: () => void) {
    if (idx >= tests.length) {
        callback()
        return
    }
    const test = tests[idx]
    get(db, test.func_params, error => {
        test.state = 'processed'
        test.error = error
        idx++
        go(db, idx, callback)
    })
}