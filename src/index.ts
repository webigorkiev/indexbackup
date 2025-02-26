import * as fs from "fs";
import * as path from "path";
import margv from "margv";
import mariadb from "mariadb";
import {stdout} from "process";
import archiver from "archiver";
import chalk from "chalk";
import {Writable} from "stream";

(async() => {
    const argv = margv();
    const showVersion = argv.v || argv.version;

    if(showVersion) {
        stdout.write("indexdump: %VERSION%" + "\n");
        process.exit(0);
    }

    // Help
    const showHelp = !!argv.help;

    if(showHelp) {
        const TAB3 = "\t\t\t";
        const TAB4 = "\t\t\t\t";
        const TAB5 = "\t\t\t\t\t";
        stdout.write(chalk.green("List of settings\n"));
        stdout.write(chalk.bold("-h/--host") + TAB4 + "host (default: 127.0.0.1)\n");
        stdout.write(chalk.bold("-P/--port") + TAB4 + "port (default: 9306)\n");
        stdout.write(chalk.bold("--dry-run") + TAB4 + "run in dry mode\n");
        stdout.write(chalk.bold("--index test1\n--index test2\n--index=test1,test2") + "\t\t" + "indexes list for dump\n");
        stdout.write(chalk.bold("--all") + TAB5 + "backup of all indexes + manticore.json if the utility can find it\n");
        stdout.write(chalk.bold("--type=rt") + TAB4 + "only RT index types. Possible values local,distributed,rt,percolate,template\n");
        stdout.write(chalk.bold("--path") + TAB5 + "path from which the index will be restored (default: current)\n");
        stdout.write(chalk.bold("--data-dir") + TAB4 + "allow to set manticore data path\n");
        stdout.write(chalk.bold("--add-config") + TAB3 + "add manticore.json to dump\n");
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
    const dataDir = argv['data-dir'] || "";
    const addConfig = !!argv['add-config'];

    dryRun && stdout.write(chalk.yellow("\n----- Start dry run -----\n"));
    const devNull = new Writable({
        write(chunk: any, encoding: BufferEncoding, callback: (error?: (Error | null)) => void) { setImmediate(callback); }
    });

    // connection
    const conn = await mariadb.createConnection({host, port});
    const arch = archiver('tar', {gzip: true});
    !dryRun && arch.pipe(stdout);
    dryRun && arch.pipe(devNull);

    let lastFile: string = "";
    const promisifyStream = (file: string, name: string) => {
        dryRun && stdout.write(`${file}`);
        return new Promise(resolve => {
            const entryListener = () => {
                arch.off("entry", entryListener);
                arch.off("error", errorListener);
                dryRun && stdout.write(chalk.green(" " + "done\n"));
                resolve(true);
            }
            const errorListener = () => {
                arch.off("entry", entryListener);
                arch.off("error", errorListener);
                dryRun && stdout.write(chalk.red(" " + "not accessible\n"));
                resolve(true);
            }
            arch
                .append(fs.createReadStream(file), {name})
                .on("entry", entryListener)
                .on("error", errorListener);
        });
    }
    const backup = async(index: string) => {
        try {
            const files: string[] = (await conn.query(`FREEZE ${index};`)).map((row: { normalized: string, file: string }) => row['file']);
            for(const file of files) {
                lastFile = file;
                await promisifyStream(file, path.join(index, path.basename(file)));
            }
        } catch(e: any) {
            dryRun && stdout.write(chalk.red(e?.message || "Unknown error" + "\n"));
        } finally {
            await conn.query(`UNFREEZE ${index};`);
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
    }

    for(const current of indexes) {
        dryRun && stdout.write(chalk.green(`${current}\n`))
        await backup(current);
    }

    if(isAll || addConfig) {
        // try to find manticore.json
        const base = dataDir || path.dirname(lastFile);
        if(base) {
            const manticoreJson = path.join(base, "..", "manticore.json");

            try {
                dryRun && stdout.write(chalk.green(`manticore.json\n`))
                await promisifyStream(manticoreJson, path.basename(manticoreJson));
            } catch(e) {}
        }
    }

    await arch.finalize();
    await conn.end();

    dryRun && stdout.write(chalk.yellow("----- End dry run -----\n\n"));
})();