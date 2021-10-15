import { logs, persons, servers } from './states_data'
import * as lib from '../src'
import { Get, TFunctionParam } from './states_get'

type TTest = {
    name: string,
    state: 'waiting' | 'processed' | 'informed',
    funcParams: TFunctionParam,
    error?: Error,
}

export const tests = [
    {
        name: 'obtain-all',
        state: 'waiting',
        funcParams: {
            func: 'obtain',
            checkPersons: persons,
            checkServers: servers,
            checkLog1: logs,
            checkLog2: logs,
            filters: [{state: 'person'}, {state: 'server'}, {state: 'log1'}, {state: 'log2'}]
        }
    },
    {
        name: 'obtain-filter',
        state: 'waiting',
        funcParams: {
            func: 'obtain',
            checkPersons: persons.filter(f => f.id === 101 && f.gender === 'woman'),
            checkServers: servers.filter(f => f.location === 'xxx'),
            checkLog1: logs.filter(f => f.isError === true),
            checkLog2: logs.filter(f => f.isError === false),
            filters: [
                {state: 'person', filters: [{index: 'id', value: '101'}, {index: 'gender', value: 'woman'}]},
                {state: 'server', filters: [{index: 'location', value: 'xxx'}]},
                {state: 'log1', filters: [{index: 'isError', value: '1'}]},
                {state: 'log2', filters: [{index: 'isError', value: '0'}]},
            ]
        }
    },
    {
        name: 'query-all',
        state: 'waiting',
        funcParams: {
            func: 'query',
            checkPersons: persons,
            checkServers: servers,
            checkLog1: logs,
            checkLog2: logs,
            filters: [{state: 'person'}, {state: 'server'}, {state: 'log1'}, {state: 'log2'}]
        }
    },
    {
        name: 'query-filter',
        state: 'waiting',
        funcParams: {
            func: 'query',
            checkPersons: persons.filter(f => f.id > 101),
            checkServers: servers.filter(f => !f.location),
            checkLog1: logs.filter(f => f.isError === true),
            checkLog2: logs.filter(f => f.isError === false),
            filters: [
                {state: 'person', filterGlobal: "$path <> 'aaa'", filters: [{index: 'id', query: '$value > 101'}, {index: 'gender', query: '$value is not null'}]},
                {state: 'server', filters: [{index: 'location', query: '$value IS NULL'}]},
                {state: 'log1', filters: [{index: 'isError', query: '$value = 1'}]},
                {state: 'log2', filters: [{index: 'isError', query: '$value = 0'}]},
            ],
        }
    }
] as TTest[]

export function Go(db: lib.IApp, idx: number, callback: () => void) {
    if (idx >= tests.length) {
        callback()
        return
    }
    const test = tests[idx]
    Get(db, test.funcParams, error => {
        test.state = 'processed'
        test.error = error
        idx++
        Go(db, idx, callback)
    })
}