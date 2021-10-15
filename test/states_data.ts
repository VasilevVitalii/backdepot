import * as path from 'path'
import * as fs from 'fs-extra'
import * as vv from 'vv-common'

export type TPerson = {
    id: number,
    gender: string,
    age: number,
    name: string,
    surname: string,
    email: string,
    father: {
        name: string,
        surname: string
    },
    mother: {
        name: string,
        surname: string
    },
    someProp0?: string,
    someProp1?: string,
    someProp2?: string
}

export type TServer = {
    name: string,
    ip: string,
    location: string
}

export type TLog = {
    date: string,
    text: string,
    isError: boolean,
}

export function SavePersons(fullPath: string) {
    persons.forEach((person, idx) => {
        const fileName = path.join(fullPath, `person${idx}.json`)
        fs.writeFileSync(fileName, JSON.stringify(person, null, 4), 'utf8')
    })
}

export function SaveServers(fullPath: string) {
    servers.forEach((server, idx) => {
        const fileName = path.join(fullPath, `server${idx}.json`)
        fs.writeFileSync(fileName, JSON.stringify(server, null, 4), 'utf8')
    })
}

export function SaveLogs(fullPath: string) {
    logs.forEach((log, idx) => {
        const p = path.join(fullPath, vv.dateFormat(vv.toDate(log.date), 'yyyymmdd'))
        fs.ensureDirSync(p)
        const fileName = path.join(p, `log${idx}.json`)
        fs.writeFileSync(fileName, JSON.stringify(log, null, 4), 'utf8')
    })
}

export const persons = [
    {
        id: 100,
        gender: "man",
        age: 68,
        name: "Benjamin",
        surname: "Taylor",
        email: "Benjamin.Taylor@bestmail.com",
        father: {
            name: "Ilon",
            surname: "Taylor"
        },
        mother: {
            name: "Evelyn",
            surname: "Taylor"
        },
        someProp0: "9681251F-95B0-07A2-2031-E1F6C46AFA03",
        someProp1: "2341EE98-254B-0E55-B521-733364EA4E3B",
        someProp2: "AB6B3F9E-A4A1-0244-0927-90F3EE9B6BEC"
    },
    {
        id: 101,
        gender: "woman",
        age: 32,
        name: "Amelia",
        surname: "Hernandez",
        email: "Amelia.Hernandez@bestmail.com",
        father: {
            name: "Liam",
            surname: "Hernandez"
        },
        mother: {
            name: "Ava",
            surname: "Hernandez"
        },
        someProp0: "2127ACDC-250D-0AEE-E1D4-35597F9AB361",
        someProp1: "E48EC8E9-EDDD-0F21-3D80-386F68849813",
        someProp2: "D4F774BA-DAE5-0240-8E84-BDC4228C5962",
        someProp3: "B13FFBCC-BFC2-0A5E-7219-3A862FE193FD"
    },
    {
        id: 102,
        gender: "man",
        age: 55,
        name: "William",
        surname: "Miller",
        email: "William.Miller@bestmail.com",
        father: {
            name: "Noah",
            surname: "Miller"
        },
        mother: {
            name: "Mia",
            surname: "Miller"
        }
    },
    {
        id: 103,
        gender: "woman",
        age: 54,
        name: "Evelyn",
        surname: "Taylor",
        email: "Evelyn.Taylor@bestmail.com",
        father: {
            name: "Liam",
            surname: "Taylor"
        },
        mother: {
            name: "Ava",
            surname: "Taylor"
        },
        someProp0: "A0423DEA-A20F-0102-983C-51F733C5EEBC",
        someProp1: "599E8420-5E42-0BB5-0750-C7710E57CA15",
        someProp2: "51568658-5372-0954-A94C-448F341A2635",
    },
    {
        id: 104,
        gender: "man",
        age: 54,
        name: "Lucas",
        surname: "Lopez",
        email: "Lucas.Lopez@bestmail.com",
        father: {
            name: "Elijah",
            surname: "Lopez"
        },
        mother: {
            name: "Harper",
            surname: "Lopez"
        },
        someProp0: "8F5FE12F-80D9-0B39-6DFD-C4AB3DFBE0EB",
        someProp1: "DAF0FE7E-DBE5-0E23-2B61-574333598307",
        someProp2: "009C630F-0E87-0C2D-C0FF-4D90F4F72875"
    }
] as TPerson[]

export const servers = [
    {
        name: 'primary',
        ip: '192.168.0.1',
        location: 'server room'
    },
    {
        name: 'slave',
        ip: '192.168.0.2',
        location: 'server room'
    },
    {
        name: 'backup',
        ip: '192.168.0.3',
        location: 'it department'
    },
    {
        name: 'additional',
        ip: '192.168.0.4',
        location: 'it department'
    }
] as TServer[]

export const logs = [
    {date: vv.dateFormat(vv.toDate('2021-10-01T00:00:00'), '126'), text: 'message text', isError: false},
    {date: vv.dateFormat(vv.toDate('2021-10-01T00:00:00'), '126'), text: 'other message text', isError: false},
    {date: vv.dateFormat(vv.toDate('2021-10-01T00:00:00'), '126'), text: 'error text', isError: true},
    {date: vv.dateFormat(vv.toDate('2021-10-02T00:00:00'), '126'), text: 'other error text', isError: true},
] as TLog[]

export function PersonCompare(v1: TPerson, v2: TPerson): boolean {
    if (v1 && v2 && v1.id === v2.id && v1.gender === v2.gender && v1.age === v2.age && v1.name === v2.name && v1.surname === v2.surname &&
        v1.email === v2.email && v1.someProp0 === v2.someProp0 && v1.someProp1 === v2.someProp1 && v1.someProp2 === v2.someProp2 &&
        JSON.stringify(v1.father) === JSON.stringify(v2.father) && JSON.stringify(v1.mother) === JSON.stringify(v2.mother)) {
            return true
    }
    return false
}

export function ServerCompare(v1: TServer , v2: TServer): boolean {
    if (v1 && v2 && v1.ip === v2.ip && v1.location === v2.location && v1.name === v2.name) {
        return true
    }
    return false
}

export function LogCompare(v1: TLog, v2: TLog): boolean {
    if (v1 && v2 &&
        v1.date === v2.date &&
        v1.text === v2.text &&
        v1.isError === v2.isError
    ){
        return true
    }
    return false
}