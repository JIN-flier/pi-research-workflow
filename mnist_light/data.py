"""MNIST data access for EXP-0001.

Protocol requirements enforced here:

* The official test set is only ever constructed inside :class:`TestSetGuard`,
  which allows exactly one successful read.
* Data is never downloaded here; ``download=False`` everywhere. Missing data
  raises a clear error that points at ``python -m mnist_light.prepare``.
* The fixed train/validation split is deterministic and recorded as a digest.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset, Subset, SubsetRandomSampler
from torchvision import transforms
from torchvision.datasets import MNIST

SPLIT_SEED = 42
TOTAL_TRAIN = 60_000
VAL_SIZE = 5_000
TRAIN_SIZE = TOTAL_TRAIN - VAL_SIZE
TEST_SIZE = 10_000

MNIST_MEAN = 0.1307
MNIST_STD = 0.3081

RAW_FILES = (
    "train-images-idx3-ubyte",
    "train-labels-idx1-ubyte",
    "t10k-images-idx3-ubyte",
    "t10k-labels-idx1-ubyte",
)


def make_split() -> tuple[np.ndarray, np.ndarray]:
    """Return ``(train_indices, val_indices)`` per the approved plan.

    ``numpy.random.default_rng(42).permutation(60000)``; the first 5,000
    permuted indices form the validation set, the remaining 55,000 the train set.
    """
    perm = np.random.default_rng(SPLIT_SEED).permutation(TOTAL_TRAIN)
    val_idx = perm[:VAL_SIZE].astype(np.int64)
    train_idx = perm[VAL_SIZE:].astype(np.int64)
    return train_idx, val_idx


def split_digest(train_idx: Sequence[int], val_idx: Sequence[int]) -> str:
    """SHA256 over the exact index arrays, in fixed order."""
    h = hashlib.sha256()
    h.update(b"train|")
    h.update(np.asarray(train_idx, dtype=np.int64).tobytes())
    h.update(b"|val|")
    h.update(np.asarray(val_idx, dtype=np.int64).tobytes())
    return h.hexdigest()


def normalize(x: torch.Tensor) -> torch.Tensor:
    """Fixed MNIST normalization: (x - 0.1307) / 0.3081."""
    return (x - MNIST_MEAN) / MNIST_STD


def build_transform() -> Callable:
    return transforms.Compose([transforms.ToTensor(), transforms.Normalize((MNIST_MEAN,), (MNIST_STD,))])


def require_raw_data(data_dir: str | Path) -> Path:
    """Fail clearly if the prepared MNIST files are absent (never download here)."""
    root = Path(data_dir)
    raw = root / "MNIST" / "raw"
    missing = [
        name for name in RAW_FILES if not (raw / name).exists() and not (raw / f"{name}.gz").exists()
    ]
    if missing:
        raise FileNotFoundError(
            f"MNIST raw files missing under {raw} ({', '.join(missing)}). "
            "Run: uv run --frozen python -m mnist_light.prepare --data-dir "
            f"{root}"
        )
    return root


def load_mnist_train(data_dir: str | Path) -> MNIST:
    root = require_raw_data(data_dir)
    return MNIST(root=str(root), train=True, transform=build_transform(), download=False)


def load_mnist_test(data_dir: str | Path) -> MNIST:
    root = require_raw_data(data_dir)
    return MNIST(root=str(root), train=False, transform=build_transform(), download=False)


def load_mnist_datasets(data_dir: str | Path) -> tuple[MNIST, MNIST]:
    """Load both official splits. Only used by data preparation checks.

    Formal training must use :func:`load_mnist_train` plus :class:`TestSetGuard`.
    """
    return load_mnist_train(data_dir), load_mnist_test(data_dir)


def make_train_loader(
    dataset: Dataset,
    indices: Sequence[int],
    batch_size: int,
    seed: int,
    epoch: int,
) -> DataLoader:
    """Per-epoch reshuffle using a seeded generator; ``num_workers=0``."""
    generator = torch.Generator()
    generator.manual_seed(int(seed) + int(epoch))
    sampler = SubsetRandomSampler(list(indices), generator=generator)
    return DataLoader(
        dataset,
        batch_size=batch_size,
        sampler=sampler,
        num_workers=0,
    )


def make_eval_loader(dataset: Dataset, indices: Sequence[int], batch_size: int) -> DataLoader:
    """Deterministic, unshuffled loader."""
    return DataLoader(
        Subset(dataset, list(indices)),
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
    )


class TestSetGuard:
    """Restrict test-set construction to a single successful read.

    The factory is only invoked on the first :meth:`read`. A failing factory
    does not consume the single permitted read.
    """

    def __init__(self, factory: Callable[[], object]) -> None:
        self._factory = factory
        self.read_count = 0
        self._value: object | None = None

    def read(self):
        if self.read_count >= 1:
            raise RuntimeError(
                "test set was already read; EXP-0001 permits exactly one test-set "
                "read in the final phase"
            )
        value = self._factory()  # may raise; in that case nothing is consumed
        self.read_count += 1
        self._value = value
        return value

    @property
    def value(self):
        return self._value

    def assert_read_once(self) -> None:
        if self.read_count != 1:
            raise RuntimeError(f"expected exactly one test-set read, observed {self.read_count}")
