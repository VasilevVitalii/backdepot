import * as vv from 'vv-common'
import * as path from 'path'
import { Dir } from './z';

export class Pk {
    readonly path: string;
    readonly file: string

    constructor(path: string, file: string) {
        this.path = path;
        this.file = file
    }

    equal (pk: Pk): boolean {
        if (vv.isEmpty(pk)) return false
        return vv.equal(this.path, pk.path) && vv.equal(this.file, pk.file)
    }
}

export function FromFile(fullFileName: string, rootPath: string): Pk {
    const p = path.parse(Dir(fullFileName))
    return new Pk(p.dir.substring(rootPath.length + 1, p.dir.length), p.base)
}