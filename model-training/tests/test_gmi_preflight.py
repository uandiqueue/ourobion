import unittest

from ourobion_model_lab.gmi_preflight import (
    _check_credentials_present,
    _check_python_version,
    run_preflight,
)


class TestCheckPythonVersion(unittest.TestCase):
    def test_matching_strict_passes(self):
        check = _check_python_version((3, 10), strict=True)
        self.assertTrue(check.passed)

    def test_mismatch_non_strict_is_informational_pass(self):
        check = _check_python_version((3, 13), strict=False)
        self.assertTrue(check.passed)

    def test_mismatch_strict_fails(self):
        check = _check_python_version((3, 13), strict=True)
        self.assertFalse(check.passed)


class TestCheckCredentialsPresent(unittest.TestCase):
    def test_present(self):
        check = _check_credentials_present({"GMI_API_KEY": "dummy"})
        self.assertTrue(check.passed)

    def test_missing(self):
        check = _check_credentials_present({})
        self.assertFalse(check.passed)
        self.assertNotIn("dummy", check.detail)


class TestRunPreflight(unittest.TestCase):
    def test_ok_when_credentials_present(self):
        report = run_preflight(env={"GMI_API_KEY": "dummy"})
        self.assertTrue(report.ok)

    def test_not_ok_when_credentials_missing(self):
        report = run_preflight(env={})
        self.assertFalse(report.ok)

    def test_to_dict_never_contains_secret_value(self):
        report = run_preflight(env={"GMI_API_KEY": "super-secret-value"})
        self.assertNotIn("super-secret-value", str(report.to_dict()))


if __name__ == "__main__":
    unittest.main()
