# Manticore Search physical backup utility

[Manticore Search](https://manticoresearch.com/) index dump utility

WARNING! Early stage of development - working with Manticore > 5.0.3

Always check the result of creating a backup

## Quick start

To work correctly, the script must be run with sudo or as a root user

```shell
yarn global add indexbackup
```

## Create physical backup

### Checking the Availability of Index Files

```shell
sudo indexbackup --dry-run index_name
```

### Locally

```shell
sudo indexbackup index_name > backup.tar.gz
```

### AWS S3

```shell
sudo indexbackup --all | aws s3 cp - s3://buket-name/daily/backup.tar.gz
```

## Options

* --all - backup of all indexes + manticore.json if the utility can find it
* -h/--host - specify host (default: 127.0.0.1)
* -P/--port - specify port (default: 9306)
* --index=index1,index2 - specify indexes
* --type=rt index types
* --add-config Backup manticore.json if the utility can find it, 
* Or you can specify the data directory --data-dir=/var/lib/manticore

### Check version

```shell
indexbackup -v
```