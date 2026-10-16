# Backups and restore

## What runs

Every night at 02:30 IST (`OffsiteBackupService`) the server:

1. Dumps the whole database (the same SQL dump as *Settings → Backup → Download database*), gzip-compressed.
2. If uploads are stored on the server disk (`STORAGE_TYPE=local`), zips them too. Uploads in R2/S3 are
   already off the server and are not copied.
3. Encrypts each file with AES-256-GCM (`BACKUP_ENCRYPTION_KEY`) into `*.crmbk`.
4. Uploads them to a **separate, private** S3-compatible bucket under `crm-backups/`.
5. Deletes backups older than `BACKUP_RETENTION_DAYS` (default 30).

If a run fails, every admin gets an in-app notification. The last result is shown at
`GET /api/admin/backup/offsite`. An admin can start a run immediately with
`POST /api/admin/backup/offsite/run`.

Columns encrypted with `PII_ENCRYPTION_KEY` (Aadhaar, PAN, bank account, IFSC) stay encrypted inside the dump.
A restored database needs **both** keys.

## One-time setup on the VPS

1. Create a new **private** bucket used only for backups. Don't use the public `jbdecor` bucket.
   A Cloudflare R2 bucket in the same account works. Turn public access off.
2. Create an API token that can only read and write that bucket.
3. Generate the key and keep a copy **somewhere other than the VPS** (a password manager):
   `openssl rand -base64 32`
4. Add to `/opt/.../.env`:

   ```
   BACKUP_ENABLED=true
   BACKUP_ENCRYPTION_KEY=<the key from step 3>
   BACKUP_BUCKET=<bucket name>
   BACKUP_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   BACKUP_ACCESS_KEY=<token access key>
   BACKUP_SECRET_KEY=<token secret>
   ```

5. Redeploy, then run one backup straight away (`POST /api/admin/backup/offsite/run` as an admin) and check
   that the file appears in the bucket.

## Restore (test this once a quarter)

1. Download the newest `database-YYYYMMDD-HHMMSS.sql.gz.crmbk` from the backup bucket.
2. Decrypt it:

   ```
   pip install cryptography
   BACKUP_ENCRYPTION_KEY=<key> python scripts/decrypt_backup.py database-....sql.gz.crmbk restore.sql.gz
   ```

3. Load it into an **empty** database (never straight over production):

   ```
   gunzip -c restore.sql.gz | mysql -u root -p arudra_crm_restore
   ```

4. Point a backend at that database with the same `PII_ENCRYPTION_KEY` and check that the app starts
   and employee bank details are readable.
