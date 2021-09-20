import * as vvs from 'vv-shared'
import * as path from 'path'
import { dir } from './z';

export class Pk {
    readonly path: string;
    readonly file: string

    constructor(path: string, file: string) {
        this.path = path;
        this.file = file
    }

    equal (pk: Pk): boolean {
        if (vvs.isEmpty(pk)) return false
        return vvs.equal(this.path, pk.path) && vvs.equal(this.file, pk.file)
    }
}

export function FromFile(full_file_name: string, root_path: string): Pk {
    const p = path.parse(dir(full_file_name))
    return new Pk(p.dir.substring(root_path.length + 1, p.dir.length), p.base)
}