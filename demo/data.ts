import * as fs from 'fs-extra'
import * as path from 'path'
import { TPerson, TTicket } from '.'
import { IApp, TypeChannelStateFilterObtain, TypeChannelStateFilterQuery } from '../src/index'

const persons: TPerson[] = [
    {name: 'Liam Smith', age: 65, gender: 'm', tags: ['tag1', 'tag2']},
    {name: 'Olivia Brown', age: 38, gender: 'w', tags: ['tag1']},
    {name: 'Elijah Johnson', age: 42, gender: 'm', tags: ['tag2', 'tag3']},
    {name: 'Alexander Miller', age: 35, gender: 'm', tags: ['tag4', 'tag2']},
    {name: 'Mia Rodriguez', age: 25, gender: 'w', tags: ['tag1', 'tag4']},
    {name: 'Charlotte Davis', age: 27, gender: 'w', tags: ['tag5', 'tag6']},
]

const tickets: TTicket[] = [
    {id: 1, author: 'Liam Smith', assegnee: [{name: 'Alexander Miller'}, {name: 'Mia Rodriguez'}], task: 'create unit test', history: {create: new Date(2021, 9, 16), deadline: new Date(2021, 9, 17)}},
    {id: 2, author: 'Alexander Miller', assegnee: [{name: 'Olivia Brown'}, {name: 'Elijah Johnson'}], task: 'review unit test', history: {create: new Date(2021, 9, 16), deadline: new Date(2021, 10, 17)}},
]

export function PrepareData(dataPath: string): {personPath: string, ticketPath: string} {
    fs.ensureDirSync(dataPath)
    fs.emptyDirSync(dataPath)
    const personPath = path.join(dataPath, 'person')
    persons.forEach((item, idx) => {
        const fileName = `person${idx + 1}.json`
        const filePath = path.join(personPath, idx > 2 ? 'tester' : 'coder')
        fs.ensureDirSync(filePath)
        fs.writeFileSync(path.join(filePath, fileName), JSON.stringify(item, null, 4), 'utf8')
    })

    const ticketPath = path.join(dataPath, 'ticket')
    fs.ensureDirSync(ticketPath)
    tickets.forEach((item, idx) => {
        const fileName = `ticket${idx + 1}.json`
        fs.writeFileSync(path.join(ticketPath, fileName), JSON.stringify(item, null, 4), 'utf8')
    })

    return {
        personPath: personPath,
        ticketPath: ticketPath
    }
}

type TFilter<T> = {
    title: string,
    filter: T,
    result?: any[]
}

type TFilterObtain = TFilter<TypeChannelStateFilterObtain>
type TFilterQuery = TFilter<TypeChannelStateFilterQuery>

export const exampleFilterObtain: TFilterObtain[] = [
    {title: `OBTAIN - PERSON: Get all persons`, filter: {state: 'person'}},
    {title: `OBTAIN - PERSON: Get persons from directory 'coder'`, filter: {state: 'person', filterPath: 'coder'}},
    {title: `OBTAIN - PERSON: Get person from file 'coder/person1.json'`, filter: {state: 'person', filterPath: 'coder', filterFile: 'person1.json'}},
    {title: `OBTAIN - PERSON: Get person with name 'Liam Smith'`, filter: {state: 'person', filters: [{index: 'name', value: 'Liam Smith'}]}},
    {title: `OBTAIN - PERSON: Get womans from directory 'tester'`, filter: {state: 'person', filterPath: 'tester', filters: [{index: 'gender', value: 'w'}]}},
    {title: `OBTAIN - PERSON: Get person with tag 'tag2'`, filter: {state: 'person', filters: [{index: 'tags', value: 'tag2'}]}},
    {title: `OBTAIN - TICKET: Get tikets where 'Alexander Miller' in assegnee`, filter: {state: 'ticket', filters: [{index: 'assegnee.name', value: 'Alexander Miller'}]}},
]

export const exampleFilterQuery: TFilterQuery[] = [
    {title: `QUERY - PERSON: Get all persons`, filter: {state: 'person'}},
    {title: `QUERY - PERSON: Get persons from directory 'coder'`, filter: {state: 'person', filterGlobal: `$path = 'coder'`}},
    {title: `QUERY - PERSON: Get person from file 'coder/person1.json'`, filter: {state: 'person', filterGlobal: `$path = 'coder' AND $file = 'person1.json'`}},
    {title: `QUERY - PERSON: Get person with name 'Liam Smith'`, filter: {state: 'person', filters: [{index: 'name', query: `$value = 'Liam Smith'`}]}},
    {title: `QUERY - PERSON: Get womans from directory 'tester'`, filter: {state: 'person', filterGlobal: `$path = 'tester'`, filters: [{index: 'gender', query: `$value = 'w'`}]}},
    {title: `QUERY - PERSON: Get person with tag 'tag2'`, filter: {state: 'person', filters: [{index: 'tags', query: `$value = 'tag2'`}]}},
    {title: `QUERY - TICKET: Get tikets where 'Alexander Miller' in assegnee`, filter: {state: 'ticket', filters: [{index: 'assegnee.name', query: `$value = 'Alexander Miller'`}]}},
]

export function GetObtain(depot: IApp, idx, callback:() => void) {
    if (idx >= exampleFilterObtain.length) {
        callback()
        return
    }
    const f = exampleFilterObtain[idx]
    depot.get.obtain([f.filter], (error, rows) => {
        if (error) {
            console.warn(error)
        }
        f.result = rows
        idx++
        GetObtain(depot, idx, callback)
    })
}

export function GetQuery(depot: IApp, idx, callback:() => void) {
    if (idx >= exampleFilterQuery.length) {
        callback()
        return
    }
    const f = exampleFilterQuery[idx]
    depot.get.query([f.filter], (error, rows) => {
        if (error) {
            console.warn(error)
        }
        f.result = rows
        idx++
        GetQuery(depot, idx, callback)
    })
}
