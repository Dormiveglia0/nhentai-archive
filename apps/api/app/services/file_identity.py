"""Keep unsigned filesystem identifiers lossless in SQLite's signed integers."""


def sqlite_file_id(value: int) -> int:
    if not 0 <= value < 1 << 64:
        raise ValueError("文件身份值超出64位范围")
    return value if value < 1 << 63 else value - (1 << 64)
