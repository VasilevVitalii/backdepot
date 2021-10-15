import * as vv from 'vv-common'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as cryptojs from 'crypto-js'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SHA512 = require("crypto-js/sha512")

export function Duplicates(whereFindDuplicates: string[]) {
    if (vv.isEmpty(whereFindDuplicates) || !Array.isArray(whereFindDuplicates)) return []
    const arr = whereFindDuplicates.map(m => { return vv.nz(vv.toString(m), '').toLowerCase().trim() }).filter(f => !vv.isEmpty(f))
    const count = cnt => cnt.reduce((a, b) => ({ ...a, [b]: (a[b] || 0) + 1}), {})
    const doubles = dict => Object.keys(dict).filter((a) => dict[a] > 1)
    return (doubles(count(arr)))
}

export function Dir(dir: string): string {
    if (vv.isEmpty(dir)) return ''
    return dir.replace(/\\/g, '/')
}

// export function nzs(s: string | undefined, def: string): string {
//     return vvs.isEmptyString(s) ? def : s as string
// }

export function ReadFiles(result: {fullFileName: string, data: string | undefined}[], idx: number, callback: (error: Error | undefined) => void): void {
    if (idx >= result.length) {
        callback(undefined)
        return
    }
    const file = result[idx]
    fs.readFile(file.fullFileName, 'utf8', (error, data) => {
        if (error) {
            callback(error)
            return
        }
        file.data = data
        idx++
        ReadFiles(result, idx, callback)
    })
}

export function EnsureDirs(dirs: string[], idx: number, callback: (error: Error | undefined) => void): void {
    if (idx >= dirs.length) {
        callback(undefined)
        return
    }
    const dir = dirs[idx]
    fs.ensureDir(dir, error => {
        if (error) {
            callback(error)
            return
        }
        idx++
        EnsureDirs(dirs, idx, callback)
    })
}

export function SaveFiles(files: {fullFileName: string, data: string}[], idx: number, callback: (error: Error | undefined) => void): void {
    if (idx >= files.length) {
        callback(undefined)
        return
    }
    try {
        const file = files[idx]
        const dir = path.parse(file.fullFileName).dir
        fs.ensureDir(dir, error => {
            if (error) {
                callback(error)
                return
            }
            fs.writeFile(file.fullFileName, file.data, error => {
                if (error) {
                    callback(error)
                    return
                }
                idx++
                SaveFiles(files, idx, callback)
            })
        })
    } catch (error) {
        callback(error as Error)
    }
}

export function DeleteFiles(files: {fullFileName: string, error: Error}[], idx: number, callback: () => void): void {
    if (idx >= files.length) {
        callback()
        return
    }
    const file = files[idx]
    if (vv.isEmpty(file.fullFileName)) {
        idx++
        DeleteFiles(files, idx, callback)
        return
    }
    fs.unlink(file.fullFileName, error => {
        if (error) {
            file.error = error
        }
        idx++
        DeleteFiles(files, idx, callback)
    })
}

export function Hash(s: string): string {
    return SHA512(s).toString(cryptojs.enc.Base64)
}

export function ToString(val: any): string {
    if (vv.isEmpty(val)) return ''
    const tf = typeof val
    if (tf === 'string') return val as string
    if (tf === 'boolean') {
        if (val === true) return 'true'
        if (val === false) return 'false'
        return ''
    }
    if (val instanceof Date) return vv.dateFormat(val, '126')
    if (val instanceof Object) return JSON.stringify(val)
    return val as string
}

export function ToNumber(val: any): number {
    if (vv.isEmpty(val)) return 0
    const tf = typeof val
    if (tf === 'boolean') {
        if (val === true) return 1
        if (val === false) return 0
        return 0
    }
    return vv.toFloat(val)
}