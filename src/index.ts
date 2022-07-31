import * as fs from "fs";
import * as path from "path";
import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import archiver from "archiver";

/**
 * indexbackup index > name.tar.gz
 * indexbackup --index=index1,index2 > name.tar.gz
 * indexbackup --all > name.tar.gz
 */
(async() => {
    const argv = margv();

    if(argv.$.length < 3) {
        console.error("Error parse arguments. Use: indexbackup index > name.tar.gz");
        process.exit(1);
    }

    const host = (argv.$.find((v: string) => v.indexOf("-h") === 0) || "").replace("-h", "") || argv["h"] || argv["host"] || "127.0.01";
    const port = (argv.$.find((v: string) => v.indexOf("-P") === 0) || "").replace("-P", "") || argv["P"] || argv["port"] || 9306;
    const index = argv.$.pop();
    let indexes = argv['index']
        ? Array.isArray(argv['index']) ? argv['index'] : argv['index'].split(",").map((v: string) => v.trim())
        : [index];
    const isAll = !!argv['all'];

    // connection
    const conn = await mariadb.createConnection({host, port});
    const arch = archiver('tar', {gzip: true});
    arch.pipe(stdout);

    const backup = async(index: string) => {
        try {
            const files: string[] = (await conn.query(`LOCK ${index};`)).map((row: { normalized: string, file: string }) => row['file']);
            for(const file of files) {
                await new Promise(resolve => arch
                    .append(fs.createReadStream(file), {name: path.join(index, path.basename(file))})
                    .on("entry", () => resolve(true))
                )
            }
        } finally {
            await conn.query(`UNLOCK ${index};`);
        }
    }

    if(isAll) {
        indexes = (await conn.query(`SHOW TABLES;`))
            .map((row: {Index: string}) => row['Index'])
    }

    for(const current of indexes) {
        await backup(current);
    }

    await arch.finalize();
    await conn.end();
})();