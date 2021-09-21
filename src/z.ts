import * as vvs from 'vv-shared'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as cryptojs from 'crypto-js'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SHA512 = require("crypto-js/sha512")

export function dir(dir: string): string {
    if (vvs.isEmptyString(dir)) return ''
    return dir.replace(/\\/g, '/')
}

export function nzs(s: string | undefined, def: string): string {
    return vvs.isEmptyString(s) ? def : s as string
}

export function readfiles(result: {full_file_name: string, data: string | undefined}[], idx: number, callback: (error: Error | undefined) => void): void {
    if (idx >= result.length) {
        callback(undefined)
        return
    }
    const file = result[idx]
    fs.readFile(file.full_file_name, 'utf8', (error, data) => {
        if (error) {
            callback(error)
            return
        }
        file.data = data
        idx++
        readfiles(result, idx, callback)
    })
}

export function ensuredirs(dirs: string[], idx: number, callback: (error: Error | undefined) => void): void {
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
        ensuredirs(dirs, idx, callback)
    })
}

export function savefiles(files: {full_file_name: string, data: string}[], idx: number, callback: (error: Error | undefined) => void): void {
    if (idx >= files.length) {
        callback(undefined)
        return
    }
    try {
        const file = files[idx]
        const dir = path.parse(file.full_file_name).dir
        fs.ensureDir(dir, error => {
            if (error) {
                callback(error)
                return
            }
            fs.writeFile(file.full_file_name, file.data, error => {
                if (error) {
                    callback(error)
                    return
                }
                idx++
                savefiles(files, idx, callback)
            })
        })
    } catch (error) {
        callback(error as Error)
    }
}

export function deletefiles(files: {full_file_name: string, error: Error}[], idx: number, callback: () => void): void {
    if (idx >= files.length) {
        callback()
        return
    }
    const file = files[idx]
    if (vvs.isEmptyString(file.full_file_name)) {
        idx++
        deletefiles(files, idx, callback)
        return
    }
    fs.unlink(file.full_file_name, error => {
        if (error) {
            file.error = error
        }
        idx++
        deletefiles(files, idx, callback)
    })
}

export function hash(s: string): string {
    return SHA512(s).toString(cryptojs.enc.Base64)
}

export function to_string(val: any): string {
    if (vvs.isEmpty(val)) return ''
    const tf = typeof val
    if (tf === 'string') return val as string
    if (tf === 'boolean') {
        if (val === true) return 'true'
        if (val === false) return 'false'
        return ''
    }
    if (val instanceof Date) return vvs.formatDate(val, 126)
    if (val instanceof Object) return JSON.stringify(val)
    return val as string
}

export function to_number(val: any): number {
    if (vvs.isEmpty(val)) return 0
    const tf = typeof val
    if (tf === 'boolean') {
        if (val === true) return 1
        if (val === false) return 0
        return 0
    }
    return vvs.toFloat(val)
}