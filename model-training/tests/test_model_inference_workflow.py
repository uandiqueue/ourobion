"""Guards on `.github/workflows/model-inference.yml`.

The workflow holds the only credential in this repository that can read the
private model bucket, so its trigger, environment and permission surface are
asserted rather than reviewed. A PyYAML dependency is not available in the
zero-install core job, so these are deliberately textual/structural checks over
the raw file — coarser than a parsed AST, but they run where it matters.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/model-inference.yml"

# `#`-comments are stripped before the prohibition checks below. The workflow
# documents what it deliberately does NOT do ("no Supabase", "no HF_TOKEN"), and
# a substring search over the raw file would read those disclaimers as the very
# references they rule out — failing the file for explaining itself.
_COMMENT_RE = re.compile(r"(?m)(?:^|(?<=\s))#.*$")


def _executable_yaml() -> str:
    """The workflow with comment text removed."""
    return _COMMENT_RE.sub("", WORKFLOW.read_text(encoding="utf-8"))


class TestWorkflowExists(unittest.TestCase):
    def test_file_is_present(self):
        self.assertTrue(WORKFLOW.is_file(), msg=f"missing workflow: {WORKFLOW}")


class TestTriggerSurface(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text(encoding="utf-8")
        # Everything from `on:` to the next top-level key.
        match = re.search(r"^on:\n(.*?)^\S", self.text, re.MULTILINE | re.DOTALL)
        self.assertIsNotNone(match, msg="could not locate the `on:` block")
        self.trigger_block = match.group(1)

    def test_workflow_dispatch_is_the_only_trigger(self):
        self.assertIn("workflow_dispatch:", self.trigger_block)

    def test_no_automatic_trigger_is_present(self):
        for forbidden in (
            "push:",
            "pull_request:",
            "pull_request_target:",
            "schedule:",
            "repository_dispatch:",
            "workflow_call:",
            "issue_comment:",
        ):
            with self.subTest(trigger=forbidden):
                self.assertNotIn(
                    forbidden,
                    self.trigger_block,
                    msg=(
                        f"{forbidden} would let this credentialed job run without a deliberate "
                        "manual dispatch"
                    ),
                )


class TestPermissionsAndEnvironment(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text(encoding="utf-8")

    def test_permissions_are_read_only(self):
        self.assertIn("permissions:\n  contents: read\n", self.text)

    def test_no_write_permission_is_granted(self):
        self.assertNotIn(": write", self.text)

    def test_job_is_gated_on_the_model_inference_environment(self):
        self.assertIn("environment: model-inference", self.text)

    def test_checkout_does_not_persist_credentials(self):
        self.assertIn("persist-credentials: false", self.text)

    def test_a_timeout_is_set(self):
        self.assertRegex(self.text, r"timeout-minutes:\s*\d+")


class TestInputSurface(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text(encoding="utf-8")

    def test_model_and_manifest_are_closed_choice_lists(self):
        self.assertEqual(
            self.text.count("type: choice"),
            2,
            msg="model and input_manifest must both be closed choice lists, not free text",
        )

    def test_manifest_options_are_the_tracked_fixtures(self):
        for name in ("zebra-smoke-v1.jsonl", "viceroy-smoke-v0.jsonl"):
            with self.subTest(manifest=name):
                self.assertIn(f"model-training/inference-manifests/{name}", self.text)
                self.assertTrue(
                    (Path(__file__).resolve().parents[1] / "inference-manifests" / name).is_file(),
                    msg=f"workflow offers {name} but it is not committed",
                )

    def test_model_manifest_pairing_is_checked(self):
        self.assertIn("is not the frozen manifest for", self.text)


class TestNoProhibitedOperations(unittest.TestCase):
    def setUp(self):
        self.text = _executable_yaml().casefold()

    def test_no_hosted_write_surface_is_referenced(self):
        for forbidden in (
            "supabase",
            "wrangler",
            "r2 put",
            "aws s3 cp",
            "git push",
            "gh release",
            "docker push",
        ):
            with self.subTest(operation=forbidden):
                self.assertNotIn(forbidden, self.text)

    def test_the_hub_is_disabled(self):
        self.assertIn("hf_hub_offline: '1'", self.text)
        self.assertIn("transformers_offline: '1'", self.text)

    def test_no_hugging_face_token_is_provisioned(self):
        self.assertNotIn("hf_token", self.text)

    def test_weights_are_never_uploaded_as_artifacts(self):
        # Only the predictions directory may be uploaded, never the model dir.
        self.assertIn("path: ${{ runner.temp }}/predictions/", WORKFLOW.read_text(encoding="utf-8"))

    def test_a_closeout_scrub_runs_on_every_exit_path(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("if: always()", text)
        self.assertIn("model weights survived the run", text)


class TestSecretHandling(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text(encoding="utf-8")

    def test_keys_come_from_secrets_and_config_from_vars(self):
        self.assertIn("MODEL_R2_ACCESS_KEY_ID: ${{ secrets.MODEL_R2_ACCESS_KEY_ID }}", self.text)
        self.assertIn(
            "MODEL_R2_SECRET_ACCESS_KEY: ${{ secrets.MODEL_R2_SECRET_ACCESS_KEY }}", self.text
        )
        self.assertIn("MODEL_R2_ENDPOINT: ${{ vars.MODEL_R2_ENDPOINT }}", self.text)
        self.assertIn("MODEL_R2_BUCKET: ${{ vars.MODEL_R2_BUCKET }}", self.text)

    def test_no_secret_is_echoed(self):
        for line in self.text.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if "secrets." in stripped and ("echo" in stripped or "printf" in stripped):
                self.fail(f"workflow line echoes a secret: {stripped}")

    def test_offline_guards_run_before_secrets_are_in_scope(self):
        guard_at = self.text.index("Offline guards (no credential in scope yet)")
        secret_at = self.text.index("secrets.MODEL_R2_ACCESS_KEY_ID")
        self.assertLess(
            guard_at,
            secret_at,
            msg="the offline test step must precede any step holding the credential",
        )


if __name__ == "__main__":
    unittest.main()
