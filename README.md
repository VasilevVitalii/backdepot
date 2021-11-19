# backdepot for backend nodejs
## Features
State storage
* Embedded
* With parallel access
* File-oriented
## Demo in folder **demo**
## License
**MIT**
## Install
```
npm i backdepot
```
## Example
```ts
import { Create as DepotCreate } from 'backdepot'
const depot = DepotCreate({
    pathMap: './map',  //OR 'MEMORY'
    pathData: undefined,
    states: [
        {name: 'person', pathData: './data/person', indexes: [
            {type: 'string', prop: 'name'},
            {type: 'number', prop: 'age'},
            {type: 'string', prop: 'gender'},
            {type: 'string', prop: 'tags'},
        ]},
        {name: 'ticket', pathData: './data/ticket', indexes: [
            {type: 'number', prop: 'id'},
            {type: 'string', prop: 'author'},
            {type: 'string', prop: 'assegnee.name'},
            {type: 'string', prop: 'history.create'},
            {type: 'string', prop: 'history.deadline'},
        ]},
    ]
})
depot.callback.onError(error => {console.warn(error)})
depot.callback.onDebug(debug => {console.log(debug)})
depot.callback.onTrace(trace => {console.log(trace)})}
depot.callback.onStateComplete(() => {
    console.log('depot ready to work')
})
depot.start()
```


