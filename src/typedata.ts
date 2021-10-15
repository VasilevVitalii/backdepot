import * as vv from 'vv-common'

export type TData = 'string' | 'json'
export type TDataShowcase = 'string' | 'native'

export class TypeDataHandler {
    readonly typedata: TData
    readonly typedataShowcase: TDataShowcase

    constructor(typedata: string | undefined, typedataShowcase: string | undefined) {
        this.typedata = typedata === 'string' || typedata === 'json' ? typedata : 'json'
        this.typedataShowcase = typedataShowcase === 'string' || typedataShowcase === 'native' ? typedataShowcase : 'native'
    }

    ext(): string {
        if (this.typedata === 'json') return '.json'
        if (this.typedata === 'string') return '.txt'
        return ''
    }

    savedata (data: string | any): string {
        try {
            if (vv.isEmpty(data)) return ''
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
            if (this.typedataShowcase === 'string') return data
            if (this.typedata === 'string') return data
            if (this.typedata === 'json') return JSON.parse(data)
        } catch (error) {
            return undefined
        }
    }
}