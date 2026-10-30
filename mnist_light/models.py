"""Model definitions with the exact architectures fixed by EXP-0001's plan.

Both models stay well under the 100,000 parameter cap. Parameter counts are
asserted at build time and re-checked by the unit tests.
"""

from __future__ import annotations

import random

import numpy as np
import torch
from torch import nn

MAX_PARAMETERS = 100_000
SEED = 42

EXPECTED_PARAMETER_COUNTS = {"mlp": 76_330, "cnn": 80_602}


def set_seed(seed: int = SEED) -> None:
    """Seed Python, NumPy and PyTorch RNGs."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


class MLP(nn.Module):
    """Flatten(784) -> Linear(784,96) -> ReLU -> Linear(96,10)."""

    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(28 * 28, 96),
            nn.ReLU(),
            nn.Linear(96, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class CNN(nn.Module):
    """Conv(1,16,3,p=1) -> ReLU -> Pool -> Conv(16,32,3,p=1) -> ReLU -> Pool -> MLP head."""

    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Flatten(),
        )
        self.head = nn.Sequential(
            nn.Linear(32 * 7 * 7, 48),
            nn.ReLU(),
            nn.Linear(48, 10),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


def _check_budget(name: str, model: nn.Module) -> nn.Module:
    params = count_parameters(model)
    if params > MAX_PARAMETERS:
        raise ValueError(f"{name} has {params} parameters, above the {MAX_PARAMETERS} cap")
    return model


def build_mlp() -> nn.Module:
    model = MLP()
    expected = EXPECTED_PARAMETER_COUNTS["mlp"]
    actual = count_parameters(model)
    if actual != expected:
        raise AssertionError(f"MLP parameter count {actual} != plan value {expected}")
    return _check_budget("mlp", model)


def build_cnn() -> nn.Module:
    model = CNN()
    expected = EXPECTED_PARAMETER_COUNTS["cnn"]
    actual = count_parameters(model)
    if actual != expected:
        raise AssertionError(f"CNN parameter count {actual} != plan value {expected}")
    return _check_budget("cnn", model)


BUILDERS = {"mlp": build_mlp, "cnn": build_cnn}


def build_model(name: str) -> nn.Module:
    try:
        builder = BUILDERS[name]
    except KeyError as exc:
        raise ValueError(f"unknown model {name!r}") from exc
    return builder()


def parameter_audit() -> dict[str, int]:
    """Build both models and report exact parameter counts (also recorded in metrics)."""
    return {name: count_parameters(builder()) for name, builder in BUILDERS.items()}
