import * as fs from 'fs-extra'
import * as path from 'path'
import { SavePersons, SaveServers, SaveLogs } from './states_data'
import * as lib from '../src'
import * as test_get from './test_get'
import * as test_set from './test_set'

const pathRoot = path.resolve(__dirname, '..', '..', 'test', 'test-states')
const pathData = path.resolve(pathRoot, 'data' )
const pathMap = path.resolve(pathRoot, 'map' )
const pathPerson = path.resolve(pathData,  'person')
const pathServer = path.resolve(pathData, 'server')
const pathLog1 = path.resolve(pathData,  'log1')
const pathLog2 = path.resolve(pathData,  'log2')

const db = lib.Create({
    pathData: pathData,
    pathMap: 'MEMORY',
    states: [{name: 'person'},{name: 'server'},{name: 'log1'},{name: 'log2'}]
}, error => {
    if (error) {
        console.warn('ERROR IN CREATE DB')
        console.warn(error)
        process.exit()
    }
})

db.callback.onError(error => {
    console.warn(error)
})

db.callback.onDebug(debug => {
    console.log(debug)
})

db.callback.onStateComplete(() => {
    console.log('STATE COMPLETE!!!')
})

db.start()