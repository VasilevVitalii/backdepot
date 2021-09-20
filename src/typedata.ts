import * as vvs from 'vv-shared'

export type TypeData = 'string' | 'json'
export type TypeDataShowcase = 'string' | 'native'

export class TypeDataHandler {
    readonly typedata: TypeData
    readonly typedata_showcase: TypeDataShowcase

    constructor(typedata: string | undefined, typedata_showcase: string | undefined) {
        this.typedata = typedata === 'string' || typedata === 'json' ? typedata : 'json'
        this.typedata_showcase = typedata_showcase === 'string' || typedata_showcase === 'native' ? typedata_showcase : 'native'
    }

    ext(): string {
        if (this.typedata === 'json') return '.json'
        if (this.typedata === 'string') return '.txt'
        return ''
    }

    savedata (data: string | any): string {
        try {
            if (vvs.isEmpty(data)) return ''
            if (typeof data === 'string') return data
            if (typeof data === 'number') return data.toString()
            if (typeof data === 'boolean') return data ? 'true' : 'false'
            return JSON.stringify(data, null, 4)
        } catch (error) {
            return ''
        }
    }

    loaddata (data: string): any | undefined {
        try {
            if (this.typedata_showcase === 'string') return data
            if (this.typedata === 'string') return data
            if (this.typedata === 'json') return JSON.parse(data)
        } catch (error) {
            return undefined
        }
    }
}