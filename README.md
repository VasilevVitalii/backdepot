# backdepot for backend nodejs
State storage
* Embedded
* With parallel access
* File-oriented

## 1. Idea
1.1. I have two array, for example, persons and tickets:
```json
person
{
    "name": "Lucas Wilson",
    "email": "lucas.wilson@mailserver.com"
}

ticket
{
    "id": 1,
    "author": "Lucas Wilson",
    "assegnee": [
        "Olivia Smith",
        "Benjamin Brown"
    ],
    "task": "create unit tests for our app",
    "deadlineDate": "2021-11-16"
}
```
1.2. This data storage in two directories. One file - one person or one ticket.
Read and edit this directories is carried out both from many app via backdepot, and from many other app without using backdepot.
App with backdepot watch two directories, contains actual state, provides easy access to read data, provides ability for edit data.

## Features

## License

## Install
```
npm i XXX
```
## Example