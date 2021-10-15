import * as vv from 'vv-common'
import { State } from "."
import { Reindex } from './reindex'
import { Rescan } from './rescan'

export function TimerRemap (state: State) {
    let timer = setTimeout(function tick() {
        if (!vv.isEmpty(state.workInfo.time_remap)) {
            timer = setTimeout(tick, 10000)
            return
        }
        Reindex(state, isSuccess => {
            if (!isSuccess) {
                timer = setTimeout(tick, 10000)
                return
            }
            Rescan(state, isSuccess => {
                if (!isSuccess) {
                    timer = setTimeout(tick, 10000)
                    return
                }
                state.workInfo.time_remap = new Date()
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                timer = setTimeout(tick, 10000)
            })
        })
    }, 0)
}