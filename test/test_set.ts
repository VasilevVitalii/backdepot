import * as vvs from 'vv-shared'
import { PersonCompare, persons, ServerCompare, servers, TypePerson, TypeServer } from './states_data'
import * as lib from '../src'
import { get } from './states_get'

type TypeTest = {
    name: string,
    state: 'waiting' | 'processed' | 'informed',
    sets: lib.TypeStateRowChange[],
    check_callback_rows?: {action: "insert" | "delete", state: string, rows: lib.TypeStateRow[]}[],
    check_callback_sets_need_error: boolean,
    check_persons: TypePerson[],
    check_servers: TypeServer[],
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
        check_callback_rows: [],
        check_callback_sets_need_error: true,
        check_persons: persons,
        check_servers: servers
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
        check_persons: persons,
        check_servers: servers
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
        check_persons: [...persons.filter(f => f.id !== 102 && f.id !== 100), {...persons[2], age: 77}, {...persons[0], id: 999, age: 111, name: 'new!'} ],
        check_servers: servers
    },
] as TypeTest[]

export function go_send(db: lib.IApp, idx: number) {
    if (idx < tests.length) {
        db.set(tests[idx].sets, key => {
            tests[idx].key = key
        })
    }
}

export function go_check(db: lib.IApp, idx: number, callback_rows: {action: "insert" | "delete", state: string, rows: lib.TypeStateRow[]}[], callback_set_error: Error, callback: () => void) {
    const test = tests[idx]

    const check_callback_rows = test.check_callback_rows || test.sets.map(m => {
        const rows = []
        m.rows.forEach(row => {
            rows.push(row)
        })

        return {
            state: m.state,
            action: m.action,
            rows: rows //as lib.TypeStateRow[]
        }
    })

    callback_rows.forEach(row => {
        check_callback_rows.filter(f => f.action === row.action && f.state === row.state).forEach(check_row => {
            for (let i = row.rows.length - 1; i >= 0; i--) {
                for (let j = check_row.rows.length - 1; j >= 0; j--) {
                    const p1 = row.rows[i]
                    const p2 = check_row.rows[j]
                    if (row.action === 'delete' && p1.path === p2.path && p1.file === p2.file) {
                        row.rows.splice(i ,1)
                        check_row.rows.splice(j, 1)
                    } else if (row.action === 'insert' && p1.path === p2.path && (p1.file === p2.file || (p1.file?.length > 20 && p2.file?.length === 0))) {
                        if (row.state === 'person' && PersonCompare(p1.data as TypePerson, p2.data as TypePerson)) {
                            row.rows.splice(i ,1)
                            check_row.rows.splice(j, 1)
                        } else if (row.state === 'server' && ServerCompare(p1.data as TypeServer, p2.data as TypeServer)) {
                            row.rows.splice(i ,1)
                            check_row.rows.splice(j, 1)
                        }
                    }
                }
            }
        })
    })

    if (check_callback_rows.filter(f => f.rows.length > 0).length > 0 || callback_rows.filter(f => f.rows.length > 0).length > 0) {
        console.log(check_callback_rows.filter(f => f.rows.length > 0), callback_rows.filter(f => f.rows.length > 0))
        test.error = new Error ('check_callback_rows.filter(f => f.rows.length > 0).length > 0 || callback_rows.filter(f => f.rows.length > 0).length > 0')
    } else if (test.check_callback_sets_need_error && !callback_set_error) {
        test.error = new Error ('set error is empty')
    }

    if (test.error) {
        test.state = 'processed'
        callback()
        return
    }

    get(db, {
        func: 'obtain',
        check_persons: test.check_persons,
        check_servers: test.check_servers,
        filters: [{state: 'person'}, {state: 'server'}]
    }, error => {
        test.state = 'processed'
        test.error = error
        callback()
    })
}