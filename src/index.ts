import * as fs from "fs";
import * as path from "path";
import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import archiver from "archiver";
import chalk from "chalk";

/**
 * indexbackup index > name.tar.gz
 * indexbackup --index=index1,index2 > name.tar.gz
 * indexbackup --all > name.tar.gz
 * indexbackup --dry-run
 */
(async() => {
    const argv = margv();
    const showVersion = argv.v || argv.version;

    if(showVersion) {
        stdout.write("indexdump: %VERSION%" + "\n");
        process.exit(0);
    }

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
    const types = argv['type']
        ? Array.isArray(argv['type']) ? argv['type'] : argv['type'].split(",").map((v: string) => v.trim())
        : argv['type'];
    const dryRun = !!argv['dry-run'];

    dryRun && stdout.write(chalk.yellow("\n----- Start dry run -----\n"));

    // connection
    const conn = await mariadb.createConnection({host, port});
    const arch = archiver('tar', {gzip: true});
    !dryRun && arch.pipe(stdout);

    const backup = async(index: string) => {
        try {
            const files: string[] = (await conn.query(`LOCK ${index};`)).map((row: { normalized: string, file: string }) => row['file']);
            for(const file of files) {
                dryRun && stdout.write(`${file}`);
                await new Promise((resolve, reject) => {
                    const entryListener = () => {
                        arch.off("entry", entryListener);
                        arch.off("error", errorListener);
                        dryRun && stdout.write(chalk.green(" " + "done\n"));
                        resolve(true);
                    }
                    const errorListener = () => {
                        arch.off("error", errorListener);
                        dryRun && stdout.write(chalk.red(" " + "not accessible\n"));
                        resolve(true);
                    }
                    arch
                        .append(fs.createReadStream(file), {name: path.join(index, path.basename(file))})
                        .on("entry", entryListener)
                        .on("error", errorListener);
                })
            }
        } catch(e: any) {
            dryRun && stdout.write(chalk.red(e?.message || "Unknown error" + "\n"));
        } finally {
            await conn.query(`UNLOCK ${index};`);
        }
    }

    if(isAll) {
        let indexesRows: {
            Index: string,
            Type: "local"|"distributed"|"rt"|"percolate"|"template"
        }[] = await conn.query(`SHOW TABLES;`);

        if(types?.length) {
            indexesRows = indexesRows.filter((index) => types.includes(index.Type));
        }

        indexes = indexesRows.map((row: {Index: string}) => row['Index']);

        // TODO manticore.conf

    }

    for(const current of indexes) {
        dryRun && stdout.write(chalk.green(`${current}\n`))
        await backup(current);
    }

    await arch.finalize();
    await conn.end();

    dryRun && stdout.write(chalk.yellow("----- End dry run -----\n\n"));
})();