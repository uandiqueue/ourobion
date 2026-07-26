import subprocess
import unittest
from unittest import mock

from ourobion_model_lab.environment import capture_environment


class TestCaptureEnvironment(unittest.TestCase):
    def test_shape_and_presence_flags(self):
        snapshot = capture_environment(env={"GMI_API_KEY": "dummy-value-never-logged"})
        d = snapshot.to_dict()
        self.assertTrue(d["python_version"])
        self.assertTrue(d["platform"])
        self.assertTrue(d["captured_at"])
        self.assertEqual(d["env_vars_present"]["GMI_API_KEY"], True)
        self.assertEqual(d["env_vars_present"]["GMI_ORG_ID"], False)
        # The dummy value itself must never appear anywhere in the snapshot.
        self.assertNotIn("dummy-value-never-logged", str(d))

    def test_git_missing_does_not_crash(self):
        with mock.patch(
            "ourobion_model_lab.environment.subprocess.run",
            side_effect=FileNotFoundError("git not found"),
        ):
            snapshot = capture_environment(env={})
            self.assertIsNone(snapshot.git_commit)

    def test_git_nonzero_exit_treated_as_unknown(self):
        completed = subprocess.CompletedProcess(args=["git"], returncode=128, stdout="")
        with mock.patch(
            "ourobion_model_lab.environment.subprocess.run", return_value=completed
        ):
            snapshot = capture_environment(env={})
            self.assertIsNone(snapshot.git_commit)


if __name__ == "__main__":
    unittest.main()
