import { Storage } from '@smythos/sdk';

//The default storage uses the Storage connector from the SRE config
//by default the SRE uses LocalStorage connector,
// you can swap it to S3 for example using
//     SRE.init({
//          Storage: {
//              Connector: 'S3',
//              Settings: {
//                  bucket: 'my-bucket',
//                  region: 'us-east-1',
//                  accessKeyId: 'my-access-key-id',
//                  secretAccessKey: 'my-secret-access-key',
//              }
//          }
//      })

const storage = Storage.default();

await storage.write('test.txt', 'Hello, world!');

const data = await storage.read('test.txt');

const dataAsString = data.toString();

console.log(dataAsString);
