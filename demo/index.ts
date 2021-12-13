import * as path from 'path'
import * as fs from 'fs-extra'
import { exampleFilterObtain, exampleFilterQuery, GetObtain, GetQuery, PrepareData } from "./data"
import { Create as DepotCreate } from '../src/index'

export type TPerson = {
    name: string,
    age: number,
    gender: ('m' | 'w'),
    tags: string[]
}

export type TTicket = {
    id: number,
    author: string,
    assegnee: {name: string}[],
    task: string,
    history: {
        create: Date,
        deadline: Date,
    }
}

function debugLevel(): ('off' | 'debug' | 'trace') {return 'debug'}

const currentPath = path.join(__dirname, '..', '..', 'demo')
const prepare = PrepareData(path.join(currentPath, 'data'))
const mapPath = path.join(currentPath, 'map')
fs.ensureDirSync(mapPath)
fs.emptyDirSync(mapPath)

const depot = DepotCreate({
    pathMap: mapPath, // OR 'MEMORY',
    pathData: undefined,
    states: [
        {name: 'person', pathData: prepare.personPath, indexes: [
            {type: 'string', prop: 'name'},
            {type: 'number', prop: 'age'},
            {type: 'string', prop: 'gender'},
            {type: 'string', prop: 'tags'},
        ]},
        {name: 'ticket', pathData: prepare.ticketPath, indexes: [
            {type: 'number', prop: 'id'},
            {type: 'string', prop: 'author'},
            {type: 'string', prop: 'assegnee.name'},
            {type: 'string', prop: 'history.create'},
            {type: 'string', prop: 'history.deadline'},
        ]},
    ]
})

depot.callback.onError(error => {
    console.warn(error)
})
if (debugLevel() === 'debug' || debugLevel() === 'trace') {
    depot.callback.onDebug(debug => {console.log(debug)})
}
if (debugLevel() === 'trace') {
    depot.callback.onTrace(trace => {console.log(trace)})
}

let persons = []
let tickets = []

depot.callback.onStateComplete(() => {
    //load all data
    depot.get.obtain([{state: 'person'}, {state: 'ticket'}], (error, loadedAll) => {
        persons = loadedAll.find(f => f.state === 'person').rows
        tickets = loadedAll.find(f => f.state === 'ticket').rows

        //demo type 1 load filtered data
        GetObtain(depot, 0, () => {
            exampleFilterObtain.forEach(item => {
                console.log(item)
            })
            //demo type 2 load filtered data
            GetQuery(depot, 0, () => {
                exampleFilterQuery.forEach(item => {
                    console.log(item)
                })

                // demo delete two persons
                depot.set([{action: 'delete', state: 'person', rows: persons.slice(0, 2)}], () => {
                    console.log('deleted')
                })
                //console.log(persons)
            })
        })
    })
})

depot.start()

// setTimeout(() => {
//     console.log(persons)
//     //depot.set([{action: 'delete', state: 'person', rows: }])
// }, 1000)



