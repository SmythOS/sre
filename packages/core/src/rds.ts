/**
 * node --loader ts-node/esm ./src/rds.ts
 * 
 * docker exec -ti smyth-sre-api ts-node ./src/scripts/createLicense.ts --customerID="1234"
 * /home/ubuntu/sre/sre-api/node_modules/.bin/ts-node /home/ubuntu/sre/sre-api/src/scripts/createLicense.ts --customerID="1234"
 */
import mysql from 'mysql2/promise';
import AWS from 'aws-sdk';
import 'dotenv/config';

(async function Main() {
    try {
        // Configure AWS SDK
        // AWS.config.update({ region: 'us-east-1' });


        let connection = await mysql.createConnection({
            host: 'smythos-sre-db.cfsmmmcga4pq.us-east-1.rds.amazonaws.com',
            user: 'app',
            password: 'yjQvsIvkdZevJlnmxqT8',
            database: 'app',
        });


        async function get() {
            const [rows] = await connection.execute("SELECT `id` FROM Agents where slug = 'factorial-calculator' LIMIT 1");
            let value = '';
            if (rows && Array.isArray(rows) && rows.length > 0 && 'id' in rows[0]) value = rows[0].id;
            return value;
        }

        async function getAll() {
            const [rows] = await connection.execute("SELECT `slug`,`id` FROM Agents");
            return rows;
        }

        console.log(await get());
        console.log(await getAll());
    } catch (err) {
        console.error(err);
    } finally {
        // db.connectionManager.close();
    }
})();
