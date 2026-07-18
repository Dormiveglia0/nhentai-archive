import os
from tempfile import TemporaryDirectory

os.environ.setdefault("NH_ARCHIVE_AUTH_DISABLED", "true")


_test_data = None
if "NH_ARCHIVE_DATA_DIR" not in os.environ:
    _test_data = TemporaryDirectory(prefix="nh-archive-tests-")
    os.environ["NH_ARCHIVE_DATA_DIR"] = _test_data.name
