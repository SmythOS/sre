import { Storage } from '@smythos/sdk';

async function main() {
    const localStorage = Storage.LocalStorage();

    await localStorage.write('test.txt', 'Hello, world!');

    const data = await localStorage.read('test.txt');

    const dataAsString = data.toString();

    console.log(dataAsString);
}

main();
