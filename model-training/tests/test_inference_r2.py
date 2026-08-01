"""SigV4 signing, credential handling, and read-only enforcement.

Every test here is offline. Signing correctness is otherwise only observable as
an opaque 403 in a workflow run that already holds the real credential, which is
the worst possible place to discover a canonicalisation bug.
"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from ourobion_model_lab.inference.r2 import (
    REQUIRED_ENV_VARS,
    R2Credentials,
    R2Error,
    build_signed_headers,
    credentials_from_env,
)

# Deliberately NOT AWS's published `AKIA…`/`wJalrXUtn…` example vector. These
# tests assert canonical-request shape and determinism, not AWS's documented
# signature, so the example vector buys nothing — and it pattern-matches the
# repo's secret scanner, which would fail the build on a string that is public
# by construction.
FAKE = R2Credentials(
    access_key_id="test-access-key-id-not-real",
    secret_access_key="test-secret-access-key-not-real",
    endpoint="https://account.r2.cloudflarestorage.com",
    bucket="ourobion-model-artifacts",
)
FIXED_TIME = datetime(2026, 7, 30, 12, 0, 0, tzinfo=timezone.utc)


class TestCredentialsFromEnv(unittest.TestCase):
    def _complete_env(self) -> dict[str, str]:
        return {
            "MODEL_R2_ACCESS_KEY_ID": "id",
            "MODEL_R2_SECRET_ACCESS_KEY": "secret",
            "MODEL_R2_ENDPOINT": "https://account.r2.cloudflarestorage.com/",
            "MODEL_R2_BUCKET": "ourobion-model-artifacts",
        }

    def test_builds_from_complete_env(self):
        creds = credentials_from_env(self._complete_env())
        self.assertEqual(creds.bucket, "ourobion-model-artifacts")
        # Trailing slash stripped so the canonical URI is not double-slashed.
        self.assertEqual(creds.endpoint, "https://account.r2.cloudflarestorage.com")

    def test_each_missing_variable_fails_closed(self):
        for name in REQUIRED_ENV_VARS:
            with self.subTest(missing=name):
                env = self._complete_env()
                del env[name]
                with self.assertRaises(R2Error) as ctx:
                    credentials_from_env(env)
                self.assertIn(name, str(ctx.exception))

    def test_blank_variable_counts_as_missing(self):
        env = self._complete_env()
        env["MODEL_R2_SECRET_ACCESS_KEY"] = "   "
        with self.assertRaises(R2Error):
            credentials_from_env(env)

    def test_missing_variable_error_names_no_value(self):
        env = self._complete_env()
        env["MODEL_R2_ACCESS_KEY_ID"] = ""
        env["MODEL_R2_SECRET_ACCESS_KEY"] = "SUPER-SECRET-VALUE"
        with self.assertRaises(R2Error) as ctx:
            credentials_from_env(env)
        self.assertNotIn("SUPER-SECRET-VALUE", str(ctx.exception))


class TestSecretRedaction(unittest.TestCase):
    def test_repr_does_not_leak_the_secret(self):
        text = repr(FAKE)
        self.assertNotIn(FAKE.secret_access_key, text)
        self.assertNotIn(FAKE.access_key_id, text)
        self.assertIn("redacted", text)

    def test_str_does_not_leak_the_secret(self):
        self.assertNotIn(FAKE.secret_access_key, str(FAKE))

    def test_fstring_interpolation_does_not_leak(self):
        self.assertNotIn(FAKE.secret_access_key, f"credentials={FAKE}")


class TestSigning(unittest.TestCase):
    def test_headers_have_the_expected_shape(self):
        headers = build_signed_headers(
            FAKE, method="GET", canonical_uri="/bucket/key.json", now=FIXED_TIME
        )
        self.assertEqual(headers["x-amz-date"], "20260730T120000Z")
        self.assertEqual(headers["Host"], "account.r2.cloudflarestorage.com")
        self.assertTrue(headers["Authorization"].startswith("AWS4-HMAC-SHA256 Credential="))
        self.assertIn("/20260730/auto/s3/aws4_request", headers["Authorization"])
        self.assertIn(
            "SignedHeaders=host;x-amz-content-sha256;x-amz-date", headers["Authorization"]
        )

    def test_empty_payload_hash_is_used_for_bodyless_reads(self):
        headers = build_signed_headers(
            FAKE, method="GET", canonical_uri="/bucket/key", now=FIXED_TIME
        )
        self.assertEqual(
            headers["x-amz-content-sha256"],
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        )

    def test_signature_is_deterministic_for_a_fixed_time(self):
        first = build_signed_headers(
            FAKE, method="GET", canonical_uri="/bucket/key", now=FIXED_TIME
        )
        second = build_signed_headers(
            FAKE, method="GET", canonical_uri="/bucket/key", now=FIXED_TIME
        )
        self.assertEqual(first["Authorization"], second["Authorization"])

    def test_different_path_yields_a_different_signature(self):
        a = build_signed_headers(FAKE, method="GET", canonical_uri="/b/one", now=FIXED_TIME)
        b = build_signed_headers(FAKE, method="GET", canonical_uri="/b/two", now=FIXED_TIME)
        self.assertNotEqual(a["Authorization"], b["Authorization"])

    def test_query_parameters_change_the_signature(self):
        plain = build_signed_headers(FAKE, method="GET", canonical_uri="/b", now=FIXED_TIME)
        listed = build_signed_headers(
            FAKE,
            method="GET",
            canonical_uri="/b",
            query={"list-type": "2", "prefix": "models/"},
            now=FIXED_TIME,
        )
        self.assertNotEqual(plain["Authorization"], listed["Authorization"])

    def test_no_credential_appears_in_a_signed_url_because_there_is_none(self):
        """Header-signed, not presigned: the secret never enters a URL."""
        headers = build_signed_headers(
            FAKE, method="GET", canonical_uri="/bucket/key", now=FIXED_TIME
        )
        joined = " ".join(headers.values())
        self.assertNotIn(FAKE.secret_access_key, joined)

    def test_naive_datetime_is_treated_as_utc_safely(self):
        # A naive datetime must not raise; astimezone() resolves it consistently.
        headers = build_signed_headers(
            FAKE, method="GET", canonical_uri="/b", now=datetime(2026, 7, 30, 12, 0, 0)
        )
        self.assertIn("x-amz-date", headers)


class TestReadOnlyEnforcement(unittest.TestCase):
    def test_write_methods_cannot_be_signed(self):
        for method in ("PUT", "POST", "DELETE", "PATCH"):
            with self.subTest(method=method):
                with self.assertRaises(R2Error) as ctx:
                    build_signed_headers(FAKE, method=method, canonical_uri="/b/k")
                self.assertIn("read-only", str(ctx.exception))

    def test_client_exposes_no_write_surface(self):
        from ourobion_model_lab.inference.r2 import ReadOnlyR2Client

        surface = {name for name in dir(ReadOnlyR2Client) if not name.startswith("_")}
        self.assertEqual(surface, {"download", "list_prefix"})


if __name__ == "__main__":
    unittest.main()
