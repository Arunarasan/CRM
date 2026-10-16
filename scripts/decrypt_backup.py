#!/usr/bin/env python3
"""Decrypt an Arudra CRM off-site backup (.crmbk) produced by OffsiteBackupService.

Usage:
    pip install cryptography
    BACKUP_ENCRYPTION_KEY=... python decrypt_backup.py database-20261016-023000.sql.gz.crmbk out.sql.gz

File layout: b"CRMBK1" | 12-byte IV | AES-256-GCM ciphertext | 16-byte tag.
The output is written only if the authentication tag verifies (a tampered or truncated file fails).
"""
import base64
import os
import sys

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b"CRMBK1"
CHUNK = 1024 * 1024


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    key_b64 = os.environ.get("BACKUP_ENCRYPTION_KEY", "").strip()
    if not key_b64:
        print("Set BACKUP_ENCRYPTION_KEY (the same base64 key the server uses).")
        return 2
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        print("BACKUP_ENCRYPTION_KEY must decode to 32 bytes.")
        return 2

    size = os.path.getsize(src)
    with open(src, "rb") as f:
        if f.read(len(MAGIC)) != MAGIC:
            print("Not a CRM backup file (bad header).")
            return 1
        iv = f.read(12)
        body_len = size - len(MAGIC) - 12 - 16
        f.seek(size - 16)
        tag = f.read(16)
        f.seek(len(MAGIC) + 12)

        decryptor = Cipher(algorithms.AES(key), modes.GCM(iv, tag)).decryptor()
        tmp = dst + ".partial"
        with open(tmp, "wb") as out:
            remaining = body_len
            while remaining > 0:
                chunk = f.read(min(CHUNK, remaining))
                remaining -= len(chunk)
                out.write(decryptor.update(chunk))
            try:
                out.write(decryptor.finalize())
            except Exception:
                out.close()
                os.remove(tmp)
                print("Authentication failed: wrong key, or the file is damaged/tampered.")
                return 1
    os.replace(tmp, dst)
    print(f"Decrypted -> {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
