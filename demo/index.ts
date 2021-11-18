import * as path from 'path'
import * as fs from 'fs-extra'
import { exampleFilterObtain, GetObtain, PrepareData } from "./data"
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
depot.callback.onStateComplete(() => {
    GetObtain(depot, 0, () => {
        exampleFilterObtain.forEach(item => {
            console.log(item)
        })
    })
})

depot.start()




