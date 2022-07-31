import * as fs from "fs";
import * as path from "path";
import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import {performance} from "perf_hooks";
import tar from "tar";
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
    const indexes = argv['index']
        ? Array.isArray(argv['index']) ? argv['index'] : argv['index'].split(",").map((v: string) => v.trim())
        : [index];
    const isAll = !!argv['all'];
    let isFirst = true;


    // connection
    const conn = await mariadb.createConnection({host, port});
    const arch = archiver('tar', {gzip: true});
    arch.pipe(stdout);

    const backup = async(index: string) => {
        try {
            // const files: string[] = (await conn.query(`LOCK ${index};`)).map((row: { normalized: string, file: string }) => row['file']);
            const files: string[] = ['/Users/igorkhomenko/projects/packages/indexbackup/README.md'];
            await new Promise(resolve => arch
                .append(fs.createReadStream(files[0]), {name: files[0]})
                .on("entry", () => resolve(true))
            )
        } finally {

        }
    }

    for(const current of indexes) {
        await backup(current);
    }

    await arch.finalize();
    await conn.end();
})();