# Manticore Search physical backup utility

[Manticore Search](https://manticoresearch.com/) index dump utility

WARNING! Early stage of development - working with Manticore > 5.0.3

## Quick start

To work correctly, the script must be run with sudo or as a root user

```shell
yarn global add indexbackup
```

## Create physical backup

### Locally

```shell
sudo indexbackup > backup.tar.gz
```

### AWS S3

```shell
sudo indexbackup > aws s3 cp - s3://fr2-manticore/daily/backup.tar.gz
```

## Options

* --all - backup of all indexes
* -h/--host - specify host (default: 127.0.0.1)
* -P/--port - specify port (default: 9306)
* --index=index1,index2 - specify indexes