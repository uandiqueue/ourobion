"""A minimal, read-only, S3-compatible client for Cloudflare R2.

Stdlib only (hashlib, hmac, urllib) — no boto3. Two reasons, in order of
weight:

1. D2 keeps the core substrate dependency-free, and the zero-install
   `model-training-core` CI job would not have boto3 available. A signing
   routine that is ~80 lines of `hmac` is a smaller thing to own than a
   transitive dependency tree that the guard job cannot install.
2. AWS SigV4 is signed *in headers* here, never as a presigned URL. That
   removes an entire leak class: there is no credential-bearing URL that could
   end up in a log line, an exception message, a shell history, or an Actions
   annotation. `urllib` request headers are not echoed by any of those.

The client exposes GET and LIST only. There is no put/delete method to call
by accident, and adding one would need this docstring to change first.
"""

from __future__ import annotations

import hashlib
import hmac
import http.client
import os
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from ..errors import ModelLabError

# R2 ignores region but SigV4 requires one in the credential scope; Cloudflare's
# documented value is "auto".
R2_REGION = "auto"
_SERVICE = "s3"
_ALGORITHM = "AWS4-HMAC-SHA256"
_EMPTY_PAYLOAD_SHA256 = hashlib.sha256(b"").hexdigest()

# 8 MiB read chunks: large enough that a ~420 MiB weights file is not thousands
# of syscalls, small enough not to hold the whole object in memory.
_DOWNLOAD_CHUNK_BYTES = 8 * 1024 * 1024

_S3_NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"


class R2Error(ModelLabError):
    """An object-storage request failed, or its configuration is incomplete."""


@dataclass(frozen=True)
class R2Credentials:
    """Bucket-scoped, read-only R2 credentials.

    Deliberately not a dataclass with a default `repr`: `__repr__` is overridden
    below so a stray f-string, `print`, or traceback frame cannot spill the
    secret. Never add these to a log record or an exception message.
    """

    access_key_id: str
    secret_access_key: str
    endpoint: str
    bucket: str

    def __repr__(self) -> str:  # pragma: no cover - trivial, but load-bearing
        return (
            f"R2Credentials(bucket={self.bucket!r}, endpoint={self.endpoint!r}, secrets=<redacted>)"
        )

    __str__ = __repr__


REQUIRED_ENV_VARS = (
    "MODEL_R2_ACCESS_KEY_ID",
    "MODEL_R2_SECRET_ACCESS_KEY",
    "MODEL_R2_ENDPOINT",
    "MODEL_R2_BUCKET",
)


def credentials_from_env(env: dict[str, str] | None = None) -> R2Credentials:
    """Build credentials from the four MODEL_R2_* variables.

    The error path names only *which variable is unset*, never any value — see
    environment.py for the same discipline applied to GMI credentials.
    """
    source = env if env is not None else dict(os.environ)
    missing = [name for name in REQUIRED_ENV_VARS if not source.get(name, "").strip()]
    if missing:
        raise R2Error(
            f"missing required environment variable(s): {missing}. "
            "Set them in model-training/.env for a local run, or in the GitHub "
            "'model-inference' environment (the two key variables as secrets, endpoint and "
            "bucket as plain variables) for a workflow run."
        )
    return R2Credentials(
        access_key_id=source["MODEL_R2_ACCESS_KEY_ID"].strip(),
        secret_access_key=source["MODEL_R2_SECRET_ACCESS_KEY"].strip(),
        endpoint=source["MODEL_R2_ENDPOINT"].strip().rstrip("/"),
        bucket=source["MODEL_R2_BUCKET"].strip(),
    )


def _sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret: str, datestamp: str, region: str, service: str) -> bytes:
    k_date = _sign(f"AWS4{secret}".encode(), datestamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    return _sign(k_service, "aws4_request")


def _canonical_query(params: dict[str, str]) -> str:
    # RFC 3986 encoding, sorted by key — S3 requires exactly this form.
    return "&".join(
        f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}"
        for k, v in sorted(params.items())
    )


def build_signed_headers(
    creds: R2Credentials,
    *,
    method: str,
    canonical_uri: str,
    query: dict[str, str] | None = None,
    now: datetime | None = None,
) -> dict[str, str]:
    """Produce SigV4 Authorization headers for a bodyless read request.

    Exposed (rather than kept private) so tests can assert the canonical
    request and signature against known vectors without performing any network
    I/O — signing correctness is otherwise only observable as a 403 in CI.
    """
    if method not in ("GET", "HEAD"):
        raise R2Error(
            f"refusing to sign a {method} request: this client is read-only by construction"
        )

    stamp = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    amz_date = stamp.strftime("%Y%m%dT%H%M%SZ")
    datestamp = stamp.strftime("%Y%m%d")
    host = urllib.parse.urlparse(creds.endpoint).netloc

    canonical_headers = (
        f"host:{host}\n"
        f"x-amz-content-sha256:{_EMPTY_PAYLOAD_SHA256}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "host;x-amz-content-sha256;x-amz-date"

    canonical_request = "\n".join(
        [
            method,
            canonical_uri,
            _canonical_query(query or {}),
            canonical_headers,
            signed_headers,
            _EMPTY_PAYLOAD_SHA256,
        ]
    )
    scope = f"{datestamp}/{R2_REGION}/{_SERVICE}/aws4_request"
    string_to_sign = "\n".join(
        [
            _ALGORITHM,
            amz_date,
            scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )
    signature = hmac.new(
        _signing_key(creds.secret_access_key, datestamp, R2_REGION, _SERVICE),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return {
        "Host": host,
        "x-amz-content-sha256": _EMPTY_PAYLOAD_SHA256,
        "x-amz-date": amz_date,
        "Authorization": (
            f"{_ALGORITHM} Credential={creds.access_key_id}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        ),
    }


def _encode_key(key: str) -> str:
    """URI-encode an object key for the canonical path, preserving separators."""
    return urllib.parse.quote(key, safe="/~")


class ReadOnlyR2Client:
    """GET and LIST against one bucket. No write method exists."""

    def __init__(self, creds: R2Credentials, *, timeout_seconds: int = 300) -> None:
        self._creds = creds
        self._timeout = timeout_seconds

    def _request(
        self, canonical_uri: str, query: dict[str, str] | None = None
    ) -> http.client.HTTPResponse:
        headers = build_signed_headers(
            self._creds, method="GET", canonical_uri=canonical_uri, query=query
        )
        url = f"{self._creds.endpoint}{canonical_uri}"
        if query:
            url = f"{url}?{_canonical_query(query)}"
        request = urllib.request.Request(url, headers=headers, method="GET")
        try:
            return urllib.request.urlopen(request, timeout=self._timeout)  # noqa: S310
        except urllib.error.HTTPError as exc:
            # The body of an S3 error is XML naming the bucket/key, which is safe;
            # the request headers (which carry the signature) are not echoed.
            raise R2Error(
                f"object storage returned HTTP {exc.code} for {canonical_uri!r}. "
                "Check that the credential is bucket-scoped to this bucket and has "
                "Object Read permission."
            ) from None
        except urllib.error.URLError as exc:
            raise R2Error(
                f"object storage request failed for {canonical_uri!r}: {exc.reason}"
            ) from None

    def list_prefix(self, prefix: str) -> list[str]:
        """Return every object key under `prefix`, following continuation tokens."""
        keys: list[str] = []
        token: str | None = None
        canonical_uri = f"/{self._creds.bucket}"
        while True:
            query = {"list-type": "2", "prefix": prefix}
            if token:
                query["continuation-token"] = token
            with self._request(canonical_uri, query) as response:
                body = response.read()
            root = ET.fromstring(body)
            for contents in root.findall(f"{_S3_NS}Contents"):
                key_node = contents.find(f"{_S3_NS}Key")
                if key_node is not None and key_node.text:
                    keys.append(key_node.text)
            truncated = root.find(f"{_S3_NS}IsTruncated")
            if truncated is None or (truncated.text or "").lower() != "true":
                break
            token_node = root.find(f"{_S3_NS}NextContinuationToken")
            if token_node is None or not token_node.text:
                break
            token = token_node.text
        return keys

    def download(self, key: str, dest: Path) -> int:
        """Stream one object to `dest`. Returns bytes written."""
        canonical_uri = f"/{self._creds.bucket}/{_encode_key(key)}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with self._request(canonical_uri) as response, open(dest, "wb") as fh:
            while True:
                chunk = response.read(_DOWNLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                fh.write(chunk)
                written += len(chunk)
        return written
