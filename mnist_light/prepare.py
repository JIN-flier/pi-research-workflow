"""One-time MNIST data preparation for EXP-0001.

This command downloads the official MNIST files into ``--data-dir``. It is run
once, outside the formal experiment, and its cost is reported separately.
It never trains or evaluates a model, and it does not report label statistics.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from torchvision.datasets import MNIST

from mnist_light.data import build_transform, require_raw_data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download the MNIST files used by EXP-0001")
    parser.add_argument("--data-dir", default="data", help="directory that will hold MNIST/raw")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    start = time.perf_counter()
    # Downloads on first call; a later call finds the existing files.
    MNIST(root=str(data_dir), train=True, transform=build_transform(), download=True)
    MNIST(root=str(data_dir), train=False, transform=build_transform(), download=True)
    elapsed = time.perf_counter() - start

    require_raw_data(data_dir)
    total_bytes = sum(
        path.stat().st_size for path in (data_dir / "MNIST" / "raw").glob("*") if path.is_file()
    )
    print(f"MNIST ready under {data_dir / 'MNIST' / 'raw'}")
    print(f"raw files total: {total_bytes / (1024 * 1024):.1f} MiB")
    print(f"prepare wall-clock: {elapsed:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
