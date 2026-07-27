"""The one canonical table of unsafe / safe manifest-and-storage path inputs.

Not a test module itself (unittest discovery only collects `test*.py`) -- it is
imported by test_data_guard, test_manifests and test_storage so all three
exercise exactly the same inputs and cannot drift apart.

Why a table at all: the defect this guards against
(`pathlib.Path("C:/secrets/x").is_absolute()` is True on Windows and False on
Linux) was invisible to a Windows-only local run and only surfaced on the Linux
CI runner. Every case below is asserted *identically on every platform*, so a
Windows dev machine and a Linux CI/GMI container must now agree.

Each unsafe row is (path, substring expected in the rejection reason).
"""

from __future__ import annotations

UNSAFE_RELATIVE_PATHS: tuple[tuple[str, str], ...] = (
    # POSIX absolute
    ("/etc/passwd", "POSIX absolute"),
    ("/", "POSIX absolute"),
    # Windows drive-letter -- the Linux-only miss. Path("C:/x").is_absolute()
    # is False on Linux, so the old guard read this as a directory named "C:".
    ("C:/secrets/x.jsonl", "drive-letter"),
    ("c:\\secrets\\x.jsonl", "drive-letter"),
    # Drive-*relative*: not "absolute" by pathlib's reckoning on EITHER
    # platform, so the old guard let it through even on Windows.
    ("C:x.jsonl", "drive-letter"),
    ("fixtures/C:/x.jsonl", "drive-letter segment"),
    # UNC
    ("\\\\server\\share\\x.jsonl", "UNC"),
    ("//server/share/x.jsonl", "UNC"),
    # Windows root-relative
    ("\\rooted\\x.jsonl", "root-relative"),
    # Backslash as a separator: a plain filename character on POSIX, a
    # separator on Windows, so the same entry means two different things.
    ("data\\x.jsonl", "backslash"),
    ("..\\..\\outside.jsonl", "backslash"),
    # Traversal
    ("../../outside.jsonl", "traversal"),
    ("fixtures/../../outside.jsonl", "traversal"),
    ("fixtures/..", "traversal"),
    ("..", "traversal"),
    # Home-directory shorthand
    ("~/secrets.jsonl", "home-directory"),
    ("~", "home-directory"),
    # Degenerate
    ("", "empty"),
    ("   ", "empty"),
    ("fixtures/x\x00.jsonl", "NUL"),
)

SAFE_RELATIVE_PATHS: tuple[str, ...] = (
    "fixtures/corpus.jsonl",
    "corpus.jsonl",
    "./fixtures/corpus.jsonl",
    "a/b/c/d.jsonl",
    "fixtures/train.part-001.jsonl",
    # A leading ".." inside a segment name is not a traversal segment.
    "fixtures/..hidden/x.jsonl",
    "fixtures/x..y.jsonl",
)
