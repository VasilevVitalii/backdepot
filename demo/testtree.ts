export function TestTree() {
    const json = {
        l1: [
            {l2: {
                l3: [
                    {l4: '5'}, {l4: '7'}
                ]
            }},
            {l2: {
                l3: [
                    {l4: '8'}, {l4: '9'}
                ]
            }},
        ]
    }

    const p = 'l1.l2.l3.l4'
    const res: {level: string, props: string[], value: any, allow: boolean}[]= [{level: 'O', props: p.split('.'), value: json, allow: true}]
    aaa(res)
    console.log(res)
}

function aaa(paths: {level: string, props: string[], value: any, allow: boolean}[]) {
    paths.filter(f => f.props.length > 0 && f.value !== undefined && f.allow).forEach(item => {
        const prop = item.props.shift()
        const value = item.value[prop]
        item.allow = false
        if (Array.isArray(value)) {
            paths.push(...value.map(m => { return {level: item.level+'.A', props: [...item.props], value: m, allow: true} }))
        } else {
            paths.push({level: item.level.concat('.O'), props: [...item.props], value: value, allow: true})
        }
    })
    if (paths.some(f => f.props.length > 0 && f.value !== undefined && f.allow)) {
        aaa(paths)
    } else {
        return
    }
}

