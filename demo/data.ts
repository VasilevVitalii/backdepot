import * as fs from 'fs-extra'
import * as path from 'path'
import { TPerson, TTicket } from '.'
import { IApp, TypeChannelStateFilterObtain, TypeChannelStateFilterQuery } from '../src/index'

const persons: TPerson[] = [
    {name: 'Liam Smith', age: 65, gender: 'm'},
    {name: 'Olivia Brown', age: 38, gender: 'w'},
    {name: 'Elijah Johnson', age: 42, gender: 'm'},
    {name: 'Alexander Miller', age: 35, gender: 'm'},
    {name: 'Mia Rodriguez', age: 25, gender: 'w'},
    {name: 'Charlotte Davis', age: 27, gender: 'w'},
]

const tickets: TTicket[] = [
    {id: 1, author: 'Liam Smith', assegnee: ['Alexander Miller', 'Mia Rodriguez'], task: 'create unit test', deadline: new Date(2021, 9, 17)},
    {id: 2, author: 'Alexander Miller', assegnee: ['Olivia Brown', 'Elijah Johnson'], task: 'review my unit test', deadline: new Date(2021, 10, 17)},
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

export const exampleFilterObtain: TFilterObtain[] = [
    {title: `PERSON: Get person with name 'Liam Smith'`, filter: {state: 'person', filters: [{index: 'name', value: 'Liam Smith'}]}},
    {title: `PERSON: Get all persons from directory 'coder'`, filter: {state: 'person', filterPath: 'coder'}},
    {title: `PERSON: Get womans from directory 'tester'`, filter: {state: 'person', filterPath: 'tester', filters: [{index: 'gender', value: 'w'}]}},
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


