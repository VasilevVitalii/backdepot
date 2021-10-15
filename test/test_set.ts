import * as vv from 'vv-common'
import { PersonCompare, persons, ServerCompare, servers, TPerson, TServer } from './states_data'
import * as lib from '../src'
import { Get } from './states_get'

type TTest = {
    name: string,
    state: 'waiting' | 'processed' | 'informed',
    sets: lib.TypeStateRowChange[],
    checkCallbackRows?: {action: "insert" | "delete", state: string, rows: lib.TypeStateRow[]}[],
    checkCallbackSetsNeedError: boolean,
    checkPersons: TPerson[],
    checkServers: TServer[],
    key?: string,
    error?: Error,
}

export const tests = [
    {
        name: 'bad-delete1',
        state: 'waiting',
        sets: [
            {state: 'person', action: 'delete', rows: [{path: '1/2/3/', file: undefined, }]},
            {state: 'person', action: 'delete', rows: [{path: '1/2/3/', file: 'file', }]},
            {state: 'person', action: 'delete', rows: [{path: undefined, file: 'file', }]},
            {state: 'person', action: 'delete', rows: [{path: undefined, file: undefined, }]},
            {state: 'server', action: 'delete', rows: [{path: '111', file: '222', }]},
            {state: 'server', action: 'delete', rows: [{path: '', file: '', }]},
            {state: 'server', action: 'delete', rows: [{path: '', file: '', }]},
            {state: '!!!', action: 'delete', rows: [{path: '', file: '', }]},
        ],
        checkCallbackRows: [],
        checkCallbackSetsNeedError: true,
        checkPersons: persons,
        checkServers: servers
    },
    {
        name: 'bad-delete2',
        state: 'waiting',
        sets: [
            {state: 'person', action: 'delete', rows: [{path: '1/2/3/', file: undefined, }]},
            {state: 'person', action: 'delete', rows: [{path: '1/2/3/', file: 'file', }]},
            {state: 'person', action: 'delete', rows: [{path: undefined, file: 'file', }]},
            {state: 'person', action: 'delete', rows: [{path: undefined, file: undefined, }]},
            {state: 'server', action: 'delete', rows: [{path: '111', file: '222', }]},
            {state: 'server', action: 'delete', rows: [{path: '', file: '', }]},
            {state: 'server', action: 'delete', rows: [{path: '', file: '', }]},
        ],
        checkPersons: persons,
        checkServers: servers
    },
    {
        name: 'varia',
        state: 'waiting',
        sets: [
            {state: 'person', action: 'delete', rows: [{path: '1/2/3/', file: 'person1.json', }]},
            {state: 'person', action: 'delete', rows: [{path: '', file: 'person0.json', }]},
            {state: 'person', action: 'insert', rows: [{path: '', file: 'person2.json', data: {...persons[2], age: 77} }]},
            {state: 'person', action: 'insert', rows: [{path: '', file: undefined, data: {...persons[0], id: 999, age: 111, name: 'new!'} }]},
        ],
        checkPersons: [...persons.filter(f => f.id !== 102 && f.id !== 100), {...persons[2], age: 77}, {...persons[0], id: 999, age: 111, name: 'new!'} ],
        checkServers: servers
    },
] as TTest[]

export function GoSend(db: lib.IApp, idx: number) {
    if (idx < tests.length) {
        db.set(tests[idx].sets, key => {
            tests[idx].key = key
        })
    }
}

export function GoCheck(db: lib.IApp, idx: number, callbackRows: {action: "insert" | "delete", state: string, rows: lib.TypeStateRow[]}[], callbackSetError: Error, callback: () => void) {
    const test = tests[idx]

    const checkCallbackRows = test.checkCallbackRows || test.sets.map(m => {
        const rows = []
        m.rows.forEach(row => {
            rows.push({
                path: row.path || '',
                file: row.file || '',
                data: row['data']
            })
        })

        return {
            state: m.state,
            action: m.action,
            rows: rows //as lib.TypeStateRow[]
        }
    })

    callbackRows.forEach(row => {
        checkCallbackRows.filter(f => f.action === row.action && f.state === row.state).forEach(checkRow => {
            for (let i = row.rows.length - 1; i >= 0; i--) {
                for (let j = checkRow.rows.length - 1; j >= 0; j--) {
                    const p1 = row.rows[i]
                    const p2 = checkRow.rows[j]
                    if (row.action === 'delete' && vv.equal(p1.path, p2.path) && vv.equal(p1.file, p2.file)) {
                        row.rows.splice(i ,1)
                        checkRow.rows.splice(j, 1)
                    } else if (row.action === 'insert' && vv.equal(p1.path, p2.path) && (vv.equal(p1.file, p2.file) || (p1.file?.length > 20 && p2.file?.length === 0))) {
                        if (row.state === 'person' && PersonCompare(p1.data as TPerson, p2.data as TPerson)) {
                            row.rows.splice(i ,1)
                            checkRow.rows.splice(j, 1)
                        } else if (row.state === 'server' && ServerCompare(p1.data as TServer, p2.data as TServer)) {
                            row.rows.splice(i ,1)
                            checkRow.rows.splice(j, 1)
                        }
                    }
                }
            }
        })
    })

    if (checkCallbackRows.filter(f => f.rows.length > 0).length > 0 || callbackRows.filter(f => f.rows.length > 0).length > 0) {
        console.log('checkCallbackRows:')
        console.log(checkCallbackRows.filter(f => f.rows.length > 0))
        console.log('callbackRows:')
        console.log(callbackRows.filter(f => f.rows.length > 0))
        test.error = new Error ('checkCallbackRows.filter(f => f.rows.length > 0).length > 0 || callbackRows.filter(f => f.rows.length > 0).length > 0')
    } else if (test.checkCallbackSetsNeedError && !callbackSetError) {
        test.error = new Error ('set error is empty')
    }

    if (test.error) {
        test.state = 'processed'
        callback()
        return
    }

    Get(db, {
        func: 'obtain',
        checkPersons: test.checkPersons,
        checkServers: test.checkServers,
        filters: [{state: 'person'}, {state: 'server'}]
    }, error => {
        test.state = 'processed'
        test.error = error
        callback()
    })
}