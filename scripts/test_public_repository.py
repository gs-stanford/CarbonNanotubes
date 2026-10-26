"""Regression tests for current-tree and history-level publication safeguards."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

GUARD = Path(__file__).with_name("check_public_repository.py")


class RepositoryBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Boundary Test")
        self.git("config", "user.email", "boundary@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        (self.repo / "scripts").mkdir()
        shutil.copy2(GUARD, self.repo / "scripts/check_public_repository.py")
        self.commit()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.repo, stderr=subprocess.STDOUT)

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "Test fixture")

    def check(self, repo=None):
        return subprocess.run([sys.executable, str((repo or self.repo) / "scripts/check_public_repository.py")],
                              capture_output=True, text=True)

    def test_clean_repository_passes(self):
        self.assertEqual(self.check().returncode, 0)

    def test_deleted_private_file_still_fails(self):
        path = self.repo / "data/private.csv"
        path.parent.mkdir()
        path.write_text("synthetic fixture\n")
        self.commit()
        path.unlink()
        self.commit()
        result = self.check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("private artifact in reachable history", result.stdout)

    def test_shallow_checkout_fails_closed(self):
        clone = Path(self.temp.name) / "shallow"
        subprocess.run(["git", "clone", "-q", "--depth=1", self.repo.as_uri(), str(clone)], check=True)
        result = self.check(clone)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Full history required", result.stdout)


if __name__ == "__main__":
    unittest.main()
