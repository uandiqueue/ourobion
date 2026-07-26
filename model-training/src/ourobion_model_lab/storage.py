"""Storage-adapter interfaces.

Only a local-filesystem adapter is implemented here -- enough to prove the
interface and unblock offline dry-run/smoke tests. A real object-storage
adapter (S3/R2, matching the plans' GMI Cold Storage / Cloudflare R2 prefix
gates) is a later, execution-run concern; do not wire one to real credentials
in this code-build.
"""
from __future__ import annotations

import abc
import shutil
from pathlib import Path


class StorageAdapter(abc.ABC):
    @abc.abstractmethod
    def put(self, local_path: str | Path, key: str) -> str:
        """Store the file at `local_path` under `key`; return a storage-local reference."""

    @abc.abstractmethod
    def get(self, key: str, local_path: str | Path) -> Path:
        """Fetch `key` to `local_path`; return the local path."""

    @abc.abstractmethod
    def exists(self, key: str) -> bool:
        ...


class LocalFilesystemStorage(StorageAdapter):
    """A disposable local-directory adapter, e.g. for smoke tests and dry runs."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        root_resolved = self.root.resolve()
        resolved = (self.root / key).resolve()
        if resolved != root_resolved and root_resolved not in resolved.parents:
            raise ValueError(f"key {key!r} escapes storage root")
        return resolved

    def put(self, local_path: str | Path, key: str) -> str:
        dest = self._resolve(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(local_path, dest)
        return str(dest)

    def get(self, key: str, local_path: str | Path) -> Path:
        src = self._resolve(key)
        dest = Path(local_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        return dest

    def exists(self, key: str) -> bool:
        return self._resolve(key).exists()
