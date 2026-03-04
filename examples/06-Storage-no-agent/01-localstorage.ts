import { Storage } from '@smythos/sdk';

// you can also explicitly specify the storage that you want to use
// here we explicitly use a local storage
const localStorage = Storage.LocalStorage();

await localStorage.write('test.txt', 'Hello, world!');

const data = await localStorage.read('test.txt');

const dataAsString = data.toString();

console.log(dataAsString);
