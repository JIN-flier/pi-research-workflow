"""Formal EXP-0001 training entry point.

Implements the approved plan exactly:

* fixed 55,000/5,000 train/validation split (seed 42) and one-time test read,
* MLP and CNN trained for exactly 3 epochs each with identical budget,
* nomination by final validation accuracy (ties -> fewer parameters),
* a single final phase that reads the test set once and evaluates each fixed
  model once,
* a metrics JSON with the full contract required by the plan.

Data is never downloaded here (``download=False``); run
``python -m mnist_light.prepare --data-dir data`` first.
"""

from __future__ import annotations

import os

# Thread limits must be set before PyTorch starts its thread pools. RUN.json
# already exports these; setdefault keeps ad-hoc invocations consistent.
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")

import argparse
import json
import resource
import subprocess
import sys
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn

from mnist_light.data import (
    TEST_SIZE,
    TOTAL_TRAIN,
    TestSetGuard,
    load_mnist_test,
    load_mnist_train,
    make_eval_loader,
    make_split,
    make_train_loader,
    split_digest,
)
from mnist_light.models import (
    MAX_PARAMETERS,
    build_model,
    count_parameters,
    parameter_audit,
    set_seed,
)

REPO_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_METRIC_FIELDS = (
    "experiment_id",
    "git_commit",
    "seed",
    "versions",
    "threads",
    "parameter_counts",
    "split_digest",
    "split_sizes",
    "epochs",
    "batch_size",
    "models",
    "nominated_model",
    "test_evaluations",
    "timings_sec",
)

MODEL_NAMES = ("mlp", "cnn")


# ---------------------------------------------------------------------------
# Config / CLI
# ---------------------------------------------------------------------------


def load_config(path: str | Path) -> dict[str, Any]:
    config_path = Path(path)
    if not config_path.is_file():
        raise FileNotFoundError(f"config file not found: {config_path}")
    with config_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="EXP-0001 MLP vs CNN on MNIST (CPU, 2 threads)")
    parser.add_argument("--config", required=True, help="path to the experiment JSON config")
    parser.add_argument("--output", required=True, help="path for the metrics JSON")
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------
# Metrics contract
# ---------------------------------------------------------------------------


def build_metrics_skeleton(
    *,
    experiment_id: str,
    git_commit: str,
    seed: int,
    threads: int,
    versions: dict[str, str],
    parameter_counts: dict[str, int],
    split_digest: str,
    split_sizes: dict[str, int],
    epochs: int,
    batch_size: int,
) -> dict[str, Any]:
    return {
        "experiment_id": experiment_id,
        "git_commit": git_commit,
        "seed": seed,
        "versions": versions,
        "threads": threads,
        "parameter_counts": parameter_counts,
        "split_digest": split_digest,
        "split_sizes": split_sizes,
        "epochs": epochs,
        "batch_size": batch_size,
        "models": {
            name: {
                "parameters": parameter_counts[name],
                "epochs": [],
                "final_val_accuracy": None,
                "test_accuracy": None,
            }
            for name in MODEL_NAMES
        },
        "nominated_model": None,
        "test_evaluations": {"count": 0, "stage": None},
        "timings_sec": {},
        "peak_rss_mb": None,
    }


def validate_metrics(
    metrics: dict[str, Any],
    *,
    expected_epochs: int = 3,
    expected_test_reads: int = 1,
) -> None:
    """Validate the plan's metrics contract; raise KeyError/ValueError on violation."""
    for field in REQUIRED_METRIC_FIELDS:
        if field not in metrics:
            raise KeyError(f"metrics missing required field: {field}")

    if metrics["threads"] != 2:
        raise ValueError(f"threads must be 2, found {metrics['threads']}")

    for name in MODEL_NAMES:
        entry = metrics["models"].get(name)
        if entry is None:
            raise ValueError(f"metrics missing model entry: {name}")
        if entry.get("parameters") is None or entry["parameters"] > MAX_PARAMETERS:
            raise ValueError(f"{name} parameter count invalid or above cap: {entry.get('parameters')}")
        epoch_records = entry.get("epochs")
        if not isinstance(epoch_records, list) or len(epoch_records) != expected_epochs:
            raise ValueError(
                f"{name} must record exactly {expected_epochs} epochs, found "
                f"{0 if not isinstance(epoch_records, list) else len(epoch_records)}"
            )
        for record in epoch_records:
            for key in ("epoch", "train_loss", "val_accuracy", "train_sec", "val_sec"):
                if key not in record:
                    raise KeyError(f"{name} epoch record missing {key}")
            if not 0.0 <= float(record["val_accuracy"]) <= 1.0:
                raise ValueError(f"{name} validation accuracy out of range: {record['val_accuracy']}")
        final = entry.get("final_val_accuracy")
        if final is None or not 0.0 <= float(final) <= 1.0:
            raise ValueError(f"{name} final validation accuracy invalid: {final}")
        test_acc = entry.get("test_accuracy")
        if test_acc is None or not 0.0 <= float(test_acc) <= 1.0:
            raise ValueError(f"{name} test accuracy invalid: {test_acc}")

    if metrics["nominated_model"] not in MODEL_NAMES:
        raise ValueError(f"nominated_model invalid: {metrics['nominated_model']}")

    evaluations = metrics["test_evaluations"]
    if evaluations.get("count") != expected_test_reads or evaluations.get("stage") != "final":
        raise ValueError(
            "test set must be read exactly once in the final phase, found "
            f"{evaluations}"
        )

    timings = metrics["timings_sec"]
    if "total" not in timings or not isinstance(timings["total"], (int, float)):
        raise ValueError(f"timings_sec missing total: {timings}")


def select_nominated_model(
    mlp_val_accuracy: float,
    cnn_val_accuracy: float,
    *,
    mlp_params: int,
    cnn_params: int,
) -> str:
    """Nominate by final validation accuracy; ties go to the smaller model."""
    if cnn_val_accuracy > mlp_val_accuracy:
        return "cnn"
    if mlp_val_accuracy > cnn_val_accuracy:
        return "mlp"
    return "mlp" if mlp_params <= cnn_params else "cnn"


def write_metrics(metrics: dict[str, Any], path: str | Path) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2, sort_keys=False)
        handle.write("\n")


# ---------------------------------------------------------------------------
# Runtime helpers
# ---------------------------------------------------------------------------


def git_commit() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def versions() -> dict[str, str]:
    import torchvision

    return {
        "python": sys.version.split()[0],
        "torch": torch.__version__,
        "torchvision": torchvision.__version__,
        "numpy": np.__version__,
    }


def configure_runtime(cfg: dict[str, Any]) -> None:
    threads = int(cfg["threads"])
    torch.set_num_threads(threads)
    torch.use_deterministic_algorithms(bool(cfg.get("deterministic", True)))
    set_seed(int(cfg["seed"]))


def peak_rss_mb() -> float:
    # ru_maxrss is in kilobytes on Linux.
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0, 1)


@torch.no_grad()
def evaluate(model: nn.Module, loader, criterion: nn.Module) -> tuple[float, float]:
    model.eval()
    total = 0
    correct = 0
    loss_sum = 0.0
    for images, targets in loader:
        logits = model(images)
        loss = criterion(logits, targets)
        loss_sum += float(loss.item()) * images.shape[0]
        correct += int((logits.argmax(dim=1) == targets).sum().item())
        total += images.shape[0]
    if total == 0:
        raise ValueError("empty evaluation loader")
    return loss_sum / total, correct / total


def train_one_model(
    name: str,
    cfg: dict[str, Any],
    train_dataset,
    val_dataset,
    train_idx: np.ndarray,
    val_idx: np.ndarray,
) -> tuple[nn.Module, list[dict[str, Any]], float, float]:
    """Train exactly ``cfg['epochs']`` epochs and return the model, curve, and timings."""
    seed = int(cfg["seed"])
    epochs = int(cfg["epochs"])
    batch_size = int(cfg["batch_size"])
    opt_cfg = cfg["optimizer"]

    set_seed(seed)
    model = build_model(name)
    params = count_parameters(model)
    if params > int(cfg["max_parameters_per_model"]):
        raise AssertionError(f"{name} has {params} parameters, above the approved cap")

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=float(opt_cfg["lr"]),
        betas=tuple(float(b) for b in opt_cfg["betas"]),
        eps=float(opt_cfg["eps"]),
        weight_decay=float(opt_cfg["weight_decay"]),
    )
    criterion = nn.CrossEntropyLoss()

    records: list[dict[str, Any]] = []
    train_total = 0.0
    val_total = 0.0

    for epoch in range(1, epochs + 1):
        loader = make_train_loader(train_dataset, train_idx, batch_size, seed, epoch)
        model.train()
        epoch_start = time.perf_counter()
        loss_sum = 0.0
        seen = 0
        for images, targets in loader:
            optimizer.zero_grad(set_to_none=True)
            logits = model(images)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()
            loss_sum += float(loss.item()) * images.shape[0]
            seen += images.shape[0]
        train_sec = time.perf_counter() - epoch_start
        train_total += train_sec

        val_loader = make_eval_loader(val_dataset, val_idx, batch_size)
        val_start = time.perf_counter()
        _, val_accuracy = evaluate(model, val_loader, criterion)
        val_sec = time.perf_counter() - val_start
        val_total += val_sec

        record = {
            "epoch": epoch,
            "train_loss": loss_sum / seen,
            "val_accuracy": val_accuracy,
            "train_sec": round(train_sec, 3),
            "val_sec": round(val_sec, 3),
        }
        records.append(record)
        print(
            f"[{name}] epoch {epoch}/{epochs} "
            f"train_loss={record['train_loss']:.6f} val_acc={val_accuracy:.4f} "
            f"train={train_sec:.1f}s val={val_sec:.1f}s",
            flush=True,
        )

    final_val = records[-1]["val_accuracy"]
    return model, records, train_total, val_total


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_experiment(cfg: dict[str, Any], output_path: str | Path) -> dict[str, Any]:
    overall_start = time.perf_counter()
    configure_runtime(cfg)

    seed = int(cfg["seed"])
    epochs = int(cfg["epochs"])
    batch_size = int(cfg["batch_size"])
    data_dir = Path(cfg["data_dir"])

    split_cfg = cfg["split"]
    train_idx, val_idx = make_split()
    if int(split_cfg["total_train_size"]) != TOTAL_TRAIN:
        raise AssertionError("source MNIST training set size does not match the approved plan")
    if len(train_idx) != int(split_cfg["train_size"]) or len(val_idx) != int(split_cfg["val_size"]):
        raise AssertionError("split sizes do not match the approved plan")
    digest = split_digest(train_idx, val_idx)

    parameter_counts = parameter_audit()
    skeleton = build_metrics_skeleton(
        experiment_id=cfg["experiment_id"],
        git_commit=git_commit(),
        seed=seed,
        threads=int(cfg["threads"]),
        versions=versions(),
        parameter_counts=parameter_counts,
        split_digest=digest,
        split_sizes={
            "train": int(len(train_idx)),
            "validation": int(len(val_idx)),
            "test": TEST_SIZE,
        },
        epochs=epochs,
        batch_size=batch_size,
    )

    # Training data only: the official test set is not touched until the final phase.
    train_dataset = load_mnist_train(data_dir)
    val_dataset = train_dataset
    setup_sec = time.perf_counter() - overall_start

    models: dict[str, nn.Module] = {}
    timings: dict[str, float] = {"setup": round(setup_sec, 3)}

    for name in MODEL_NAMES:
        model, records, train_sec, val_sec = train_one_model(
            name, cfg, train_dataset, val_dataset, train_idx, val_idx
        )
        models[name] = model
        entry = skeleton["models"][name]
        entry["epochs"] = records
        entry["final_val_accuracy"] = records[-1]["val_accuracy"]
        entry["train_sec"] = round(train_sec, 3)
        entry["val_sec"] = round(val_sec, 3)
        timings[f"train_{name}"] = round(train_sec + val_sec, 3)

    skeleton["nominated_model"] = select_nominated_model(
        skeleton["models"]["mlp"]["final_val_accuracy"],
        skeleton["models"]["cnn"]["final_val_accuracy"],
        mlp_params=parameter_counts["mlp"],
        cnn_params=parameter_counts["cnn"],
    )

    # ---- single final phase: one test-set read, each fixed model evaluated once ----
    guard = TestSetGuard(
        lambda: make_eval_loader(
            load_mnist_test(data_dir),
            np.arange(TEST_SIZE, dtype=np.int64),
            batch_size,
        )
    )
    test_sec_start = time.perf_counter()
    test_loader = guard.read()
    criterion = nn.CrossEntropyLoss()
    for name in MODEL_NAMES:
        _, test_accuracy = evaluate(models[name], test_loader, criterion)
        skeleton["models"][name]["test_accuracy"] = test_accuracy
        print(f"[{name}] final one-time test_accuracy={test_accuracy:.4f}", flush=True)
    guard.assert_read_once()
    timings["final_test"] = round(time.perf_counter() - test_sec_start, 3)

    skeleton["test_evaluations"] = {
        "count": guard.read_count,
        "stage": "final",
        "models": list(MODEL_NAMES),
    }
    if guard.read_count != 1:
        raise AssertionError("the test set must be read exactly once")

    timings["total"] = round(time.perf_counter() - overall_start, 3)
    skeleton["timings_sec"] = timings
    skeleton["peak_rss_mb"] = peak_rss_mb()

    validate_metrics(skeleton)
    write_metrics(skeleton, output_path)
    print(
        f"nominated_model={skeleton['nominated_model']} "
        f"cnn_val={skeleton['models']['cnn']['final_val_accuracy']:.4f} "
        f"mlp_val={skeleton['models']['mlp']['final_val_accuracy']:.4f} "
        f"total={timings['total']:.1f}s metrics={output_path}",
        flush=True,
    )
    return skeleton


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    cfg = load_config(args.config)
    run_experiment(cfg, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
