import * as vvs from 'vv-shared'
import * as path from 'path'
import * as lib from './src/index'

const db = lib.create({
    path_data: path.join('sandbox-state', 'data'),
    path_map:  path.join('sandbox-state', 'map'),
    states: [
        {name: 'server', indexes: [{prop: 'instance', type: 'string'}]},
        {name: 'task'},
        //{name: 'person', indexes: [{prop: 'age', type: 'number'}, {prop: 'gender', type: 'string'}]}
    ]
}, error => {
    if (error) {
        console.warn('ERROR ON START!')
        console.log(error)
        process.exit()
    }
    console.log('APP START')
})

db.callback.on_error(error => {
    //console.log(`${vvs.format(new Date(), 126)}   ERROR   ${error}`)
})
db.callback.on_debug(debug => {
    //console.log(`${vvs.format(new Date(), 126)}   DEBUG   ${debug}`)
})
// db.callback.on_trace(trace => {
//     console.log(`${vvs.format(new Date(), 126)}   TRACE   ${trace}`)
// })
db.callback.on_state_complete(() => {
    // console.log('on_state_change_init')
    // db.get.obtain([{state: 'server'},{state: 'task'}], (error, states) => {
    //     console.log('GET STATES (obtain)!')
    //     if (error) {
    //         console.log(error.message)
    //     }
    //     console.log(states)
    // })
    // db.get.query([{state: 'server'},{state: 'task'}], (error, states) => {
    //     console.log('GET STATES! (query)')
    //     if (error) {
    //         console.log(error.message)
    //     }
    //     console.log(states)
    // })
})
db.callback.on_state_change((rows,sets) => {
    const d = vvs.formatDate(new Date(), 126)
    rows.forEach(row1 => {
        row1.rows.forEach(row2 => {
            console.log(`STATE ${row1.state} ${row1.action} ${d}  ${path.join(row2.path, row2.file)}`)
        })
    })

    sets.forEach(s => {
        console.log(`STATE KEY CHANGE ${s.key}  ${s.error}`)
    })
})

db.start()

db.set(
    [
        {state: 'server', action: 'insert', rows:
            [
                {path: '', file: 'mssql-server-1.json', data: {instance: "odin/run2010"}},
                {path: '', file: 'mssql-server-99.json', data: {instance: "99"}},
                {path: undefined, file: 'mssql-server-88.json', data: {instance: "88"}},
                {path: '234/789', file: 'mssql-server-88.json', data: {instance: "234_789_88"}},
                {path: undefined, file: undefined, data: {instance: "!!!"}},
            ]
        },
        {state: 'task', action: 'insert', rows:
            [
                {path: undefined, file: undefined, data: 'hello'},
            ]
        },
    ]
, key => {
    console.log(`DB SET KEY ${key}`)
})

