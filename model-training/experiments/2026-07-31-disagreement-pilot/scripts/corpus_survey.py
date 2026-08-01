"""Standalone, read-only survey of the ourobion-corpus bucket.

Deliberately OUTSIDE the shipped inference package. It reuses the reviewed
`build_signed_headers` signing helper (which signs a request and enforces
read-only methods) but does NOT touch `assert_allowed_target`, so the model
runner's bucket pin stays intact and unmodified. Corpus access is a separate
concern from the model-artifact runner and is kept that way.

Read-only: GET and LIST only, exactly like the runner's client.
"""

from __future__ import annotations

import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

sys.path.insert(0, "/home/uandiqueue/project/wt-266/model-training/src")
from ourobion_model_lab.inference.r2 import (  # noqa: E402
    R2Credentials,
    build_signed_headers,
)

NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"


def load_env(path: str) -> dict[str, str]:
    env = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def corpus_credentials() -> R2Credentials:
    env = load_env("/home/uandiqueue/project/ourobion/tools/brain-ingest/.env")
    return R2Credentials(
        access_key_id=env["R2_ACCESS_KEY_ID"],
        secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        endpoint=env["R2_ENDPOINT"].rstrip("/"),
        bucket=env["R2_BUCKET"],
    )


def _get(creds: R2Credentials, canonical_uri: str, query: dict | None = None) -> bytes:
    headers = build_signed_headers(
        creds, method="GET", canonical_uri=canonical_uri, query=query
    )
    url = f"{creds.endpoint}{canonical_uri}"
    if query:
        url += "?" + "&".join(
            f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}"
            for k, v in sorted(query.items())
        )
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=120) as r:  # noqa: S310
        return r.read()


def list_prefix(creds: R2Credentials, prefix: str, limit: int | None = None) -> list[str]:
    keys: list[str] = []
    token = None
    while True:
        q = {"list-type": "2", "prefix": prefix}
        if token:
            q["continuation-token"] = token
        root = ET.fromstring(_get(creds, f"/{creds.bucket}", q))
        for c in root.findall(f"{NS}Contents"):
            k = c.find(f"{NS}Key")
            if k is not None and k.text:
                keys.append(k.text)
        if limit and len(keys) >= limit:
            return keys[:limit]
        tr = root.find(f"{NS}IsTruncated")
        if tr is None or (tr.text or "").lower() != "true":
            break
        nt = root.find(f"{NS}NextContinuationToken")
        if nt is None or not nt.text:
            break
        token = nt.text
    return keys


def get_object(creds: R2Credentials, key: str) -> bytes:
    return _get(creds, f"/{creds.bucket}/{urllib.parse.quote(key, safe='/~')}")


if __name__ == "__main__":
    creds = corpus_credentials()
    keys = list_prefix(creds, "")
    print(f"bucket={creds.bucket} objects={len(keys)}")
    print("top-level:", Counter(k.split("/")[0] for k in keys).most_common())
    print("\nsample text/ keys:")
    for k in [k for k in keys if k.startswith("text/")][:5]:
        print("  ", k)
    print("\nsample manifest keys:")
    for k in [k for k in keys if k.startswith("manifest/")][:5]:
        print("  ", k)
