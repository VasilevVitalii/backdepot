//@ts-check

const path = require('path')
const fs = require('fs-extra')
const vv = require('vv-common')

/**
 * @param {number} count
 */
function generate_person(count) {
    const p = path.join(__dirname, 'test-state', 'person')
    fs.emptyDirSync(p)
    const man_names = ['Liam','Noah', 'Oliver', 'Elijah', 'William', 'James', 'Benjamin', 'Lucas', 'Henry', 'Alexander']
    const woman_names = ['Olivia', 'Emma', 'Ava', 'Charlotte', 'Sophia', 'Amelia', 'Isabella', 'Mia', 'Evelyn', 'Harper']
    const surnames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzales','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin']

    const man_names_len = man_names.length
    const woman_names_len = woman_names.length
    const surnames_len = surnames.length

    for (let i = 0; i < count; i++) {
        const gender = Math.floor(Math.random() * 2) === 0 ? 'man' : 'woman'
        const name = gender === 'man' ? man_names[Math.floor(Math.random() * man_names_len)] :  woman_names[Math.floor(Math.random() * woman_names_len)]
        const surname = surnames[Math.floor(Math.random() * surnames_len)]

        const person = {
            id: i,
            gender: gender,
            age: Math.floor(Math.random() * 80) + 20,
            name: name,
            surname: surname,
            email: `${name}.${surname}@bestmail.com`,
            father: {
                name: man_names[Math.floor(Math.random() * man_names_len)],
                surname: surname
            },
            mother: {
                name: woman_names[Math.floor(Math.random() * woman_names_len)],
                surname: surname
            },
            some_prop0: vv.guid(),
            some_prop1: vv.guid(),
            some_prop2: vv.guid(),
            some_prop3: vv.guid(),
            some_prop4: vv.guid(),
            some_prop5: vv.guid(),
            some_prop6: vv.guid(),
            some_prop7: vv.guid(),
            some_prop8: vv.guid(),
            some_prop9: vv.guid(),
            fdm: vv.dateFormat(new Date(), '126')
        }

        const subpath = count <= 200 ? '' : Math.floor(i/100).toString()
        if (!vv.isEmpty(subpath)) {
            fs.ensureDirSync(path.join(p, subpath))
        }
        fs.writeFileSync(path.join(p, subpath, `${i}.json`), JSON.stringify(person, null, 4), {encoding: 'utf8'})
    }
    console.log('DONE!')
}
exports.generate_person = generate_person