"""Unit tests for the EXP-0001 implementation (mnist_light).

These tests never download data and never train a model: they only exercise the
approved protocol surface (parameter counts, fixed split, config/metrics
contract, and the one-shot test-set access guard).
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = REPO_ROOT / "configs" / "exp0001.json"


# ---------------------------------------------------------------------------
# Models: exact parameter counts from the approved plan
# ---------------------------------------------------------------------------


def test_mlp_parameter_count_is_exact():
    from mnist_light.models import build_mlp, count_parameters

    model = build_mlp()
    assert count_parameters(model) == 76_330


def test_cnn_parameter_count_is_exact():
    from mnist_light.models import build_cnn, count_parameters

    model = build_cnn()
    assert count_parameters(model) == 80_602


def test_both_models_stay_under_parameter_cap():
    from mnist_light.models import MAX_PARAMETERS, build_cnn, build_mlp, count_parameters

    assert MAX_PARAMETERS == 100_000
    for builder in (build_mlp, build_cnn):
        model = builder()
        assert count_parameters(model) <= MAX_PARAMETERS


def test_parameter_audit_reports_both_models():
    from mnist_light.models import parameter_audit

    audit = parameter_audit()
    assert audit == {"mlp": 76_330, "cnn": 80_602}


def test_models_are_reproducible_under_fixed_seed():
    import torch

    from mnist_light.models import build_cnn, build_mlp, set_seed

    set_seed(42)
    first = build_mlp()
    set_seed(42)
    second = build_mlp()
    for a, b in zip(first.parameters(), second.parameters(), strict=True):
        assert torch.equal(a, b)

    set_seed(42)
    cnn_a = build_cnn()
    set_seed(42)
    cnn_b = build_cnn()
    for a, b in zip(cnn_a.parameters(), cnn_b.parameters(), strict=True):
        assert torch.equal(a, b)


def test_model_forward_shapes():
    import torch

    from mnist_light.models import build_cnn, build_mlp

    x = torch.zeros(4, 1, 28, 28)
    assert build_mlp()(x).shape == (4, 10)
    assert build_cnn()(x).shape == (4, 10)


# ---------------------------------------------------------------------------
# Fixed split: sizes, mutual exclusivity, reproducibility, digest
# ---------------------------------------------------------------------------


def test_split_sizes_are_55000_and_5000():
    from mnist_light.data import make_split

    train_idx, val_idx = make_split()
    assert len(train_idx) == 55_000
    assert len(val_idx) == 5_000


def test_split_is_disjoint_and_covers_all_training_indices():
    from mnist_light.data import make_split

    train_idx, val_idx = make_split()
    train_set = set(train_idx.tolist())
    val_set = set(val_idx.tolist())
    assert train_set.isdisjoint(val_set)
    assert train_set | val_set == set(range(60_000))


def test_split_matches_plan_rule_exactly():
    from mnist_light.data import make_split

    perm = np.random.default_rng(42).permutation(60_000)
    train_idx, val_idx = make_split()
    np.testing.assert_array_equal(val_idx, perm[:5_000])
    np.testing.assert_array_equal(train_idx, perm[5_000:])


def test_split_is_reproducible_and_stable_across_calls():
    from mnist_light.data import make_split, split_digest

    a = make_split()
    b = make_split()
    np.testing.assert_array_equal(a[0], b[0])
    np.testing.assert_array_equal(a[1], b[1])
    assert split_digest(*a) == split_digest(*b)
    assert len(split_digest(*a)) == 64


def test_split_digest_is_sensitive_to_index_content():
    from mnist_light.data import split_digest

    train_idx, val_idx = np.arange(0, 10), np.arange(10, 20)
    baseline = split_digest(train_idx, val_idx)
    tampered = split_digest(train_idx[::-1], val_idx)
    assert baseline != tampered


def test_normalization_constants_match_plan():
    from mnist_light.data import MNIST_MEAN, MNIST_STD, normalize

    assert MNIST_MEAN == 0.1307
    assert MNIST_STD == 0.3081
    import torch

    x = torch.tensor([MNIST_MEAN, MNIST_MEAN + MNIST_STD])
    out = normalize(x)
    assert out[0].item() == pytest.approx(0.0, abs=1e-6)
    assert out[1].item() == pytest.approx(1.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Test-set access guard: the test set may be read exactly once
# ---------------------------------------------------------------------------


def test_test_set_guard_allows_first_read_and_rejects_second():
    from mnist_light.data import TestSetGuard

    guard = TestSetGuard(lambda: object())
    first = guard.read()
    assert first is not None
    assert guard.read_count == 1
    with pytest.raises(RuntimeError):
        guard.read()
    assert guard.read_count == 1


def test_test_set_guard_assert_once_raises_before_any_read():
    from mnist_light.data import TestSetGuard

    guard = TestSetGuard(lambda: object())
    with pytest.raises(RuntimeError):
        guard.assert_read_once()
    guard.read()
    guard.assert_read_once()


def test_failed_test_set_construction_does_not_consume_the_single_read():
    from mnist_light.data import TestSetGuard

    def broken():
        raise FileNotFoundError("no data")

    guard = TestSetGuard(broken)
    with pytest.raises(FileNotFoundError):
        guard.read()
    assert guard.read_count == 0


def test_missing_dataset_raises_and_never_downloads(tmp_path):
    from mnist_light.data import load_mnist_datasets

    with pytest.raises((FileNotFoundError, RuntimeError)):
        load_mnist_datasets(tmp_path)
    # download must not have created anything
    assert not (tmp_path / "MNIST" / "raw").exists() or not any(
        (tmp_path / "MNIST" / "raw").glob("*.gz")
    )


# ---------------------------------------------------------------------------
# Config contract
# ---------------------------------------------------------------------------


def test_config_holds_approved_hyperparameters():
    from mnist_light.train import load_config

    cfg = load_config(CONFIG_PATH)
    assert cfg["experiment_id"] == "EXP-0001"
    assert cfg["seed"] == 42
    assert cfg["epochs"] == 3
    assert cfg["batch_size"] == 128
    assert cfg["threads"] == 2
    assert cfg["optimizer"] == {
        "name": "adam",
        "lr": 1e-3,
        "betas": [0.9, 0.999],
        "eps": 1e-8,
        "weight_decay": 0.0,
    }
    assert cfg["split"] == {
        "seed": 42,
        "total_train_size": 60_000,
        "train_size": 55_000,
        "val_size": 5_000,
    }
    assert cfg["normalization"] == {"mean": 0.1307, "std": 0.3081}
    assert cfg["max_parameters_per_model"] == 100_000
    assert cfg["models"] == ["mlp", "cnn"]
    assert cfg["test_evaluation_stage"] == 1
    assert cfg["selection"] == "final_validation_accuracy_ties_fewer_parameters"
    assert cfg["deterministic"] is True


def test_config_rejects_missing_file(tmp_path):
    from mnist_light.train import load_config

    with pytest.raises(FileNotFoundError):
        load_config(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# Metrics contract
# ---------------------------------------------------------------------------


def sample_metrics() -> dict:
    import torch

    from mnist_light.train import build_metrics_skeleton

    return build_metrics_skeleton(
        experiment_id="EXP-0001",
        git_commit="b71c3fe135362856f950392eb395963c55c8543f",
        seed=42,
        threads=2,
        versions={
            "python": "3.12.14",
            "torch": torch.__version__,
            "torchvision": "0.29.2",
            "numpy": np.__version__,
        },
        parameter_counts={"mlp": 76_330, "cnn": 80_602},
        split_digest="a" * 64,
        split_sizes={"train": 55_000, "validation": 5_000, "test": 10_000},
        epochs=3,
        batch_size=128,
    )


def test_metrics_skeleton_contains_every_plan_field():
    from mnist_light.train import REQUIRED_METRIC_FIELDS

    metrics = sample_metrics()
    for field in REQUIRED_METRIC_FIELDS:
        assert field in metrics, field
    for model in ("mlp", "cnn"):
        entry = metrics["models"][model]
        assert entry["parameters"] in (76_330, 80_602)
        assert entry["epochs"] == []
        assert entry["final_val_accuracy"] is None
        assert entry["test_accuracy"] is None


def test_required_metric_fields_cover_plan_requirements():
    from mnist_light.train import REQUIRED_METRIC_FIELDS

    required = set(REQUIRED_METRIC_FIELDS)
    expected = {
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
    }
    assert expected <= required


def test_validate_metrics_accepts_complete_record():
    from mnist_light.train import validate_metrics

    metrics = sample_metrics()
    for model in ("mlp", "cnn"):
        metrics["models"][model]["epochs"] = [
            {"epoch": e, "train_loss": 0.2, "val_accuracy": 0.9, "train_sec": 1.0, "val_sec": 0.1}
            for e in range(1, 4)
        ]
        metrics["models"][model]["final_val_accuracy"] = 0.9
        metrics["models"][model]["test_accuracy"] = 0.9
    metrics["nominated_model"] = "cnn"
    metrics["timings_sec"] = {"setup": 0.1, "train_mlp": 1.0, "train_cnn": 1.0, "final_test": 0.1, "total": 2.2}
    metrics["test_evaluations"] = {"count": 1, "stage": "final"}
    validate_metrics(metrics)


@pytest.mark.parametrize("missing", ["split_digest", "nominated_model", "test_evaluations", "timings_sec"])
def test_validate_metrics_rejects_missing_top_level_field(missing):
    from mnist_light.train import validate_metrics

    metrics = sample_metrics()
    for model in ("mlp", "cnn"):
        metrics["models"][model]["epochs"] = [
            {"epoch": e, "train_loss": 0.2, "val_accuracy": 0.9, "train_sec": 1.0, "val_sec": 0.1}
            for e in range(1, 4)
        ]
        metrics["models"][model]["final_val_accuracy"] = 0.9
        metrics["models"][model]["test_accuracy"] = 0.9
    metrics["nominated_model"] = "cnn"
    metrics["timings_sec"] = {"total": 1.0}
    metrics["test_evaluations"] = {"count": 1, "stage": "final"}
    broken = copy.deepcopy(metrics)
    broken.pop(missing)
    with pytest.raises((KeyError, ValueError)):
        validate_metrics(broken)


def test_validate_metrics_rejects_wrong_epoch_count_or_duplicate_test_read():
    from mnist_light.train import validate_metrics

    metrics = sample_metrics()
    for model in ("mlp", "cnn"):
        metrics["models"][model]["epochs"] = [
            {"epoch": e, "train_loss": 0.2, "val_accuracy": 0.9, "train_sec": 1.0, "val_sec": 0.1}
            for e in range(1, 3)  # only 2 epochs -> illegal
        ]
        metrics["models"][model]["final_val_accuracy"] = 0.9
        metrics["models"][model]["test_accuracy"] = 0.9
    metrics["nominated_model"] = "cnn"
    metrics["timings_sec"] = {"total": 1.0}
    metrics["test_evaluations"] = {"count": 1, "stage": "final"}
    with pytest.raises(ValueError):
        validate_metrics(metrics)

    ok = copy.deepcopy(metrics)
    for model in ("mlp", "cnn"):
        ok["models"][model]["epochs"].append(
            {"epoch": 3, "train_loss": 0.2, "val_accuracy": 0.9, "train_sec": 1.0, "val_sec": 0.1}
        )
    validate_metrics(ok)
    ok["test_evaluations"] = {"count": 2, "stage": "final"}
    with pytest.raises(ValueError):
        validate_metrics(ok)


def test_select_nominated_model_uses_val_accuracy_then_fewer_parameters():
    from mnist_light.train import select_nominated_model

    assert (
        select_nominated_model(mlp_val_accuracy=0.97, cnn_val_accuracy=0.98, mlp_params=76_330, cnn_params=80_602)
        == "cnn"
    )
    assert (
        select_nominated_model(mlp_val_accuracy=0.98, cnn_val_accuracy=0.97, mlp_params=76_330, cnn_params=80_602)
        == "mlp"
    )
    # tie -> fewer parameters wins (MLP has 76,330 < 80,602)
    assert (
        select_nominated_model(mlp_val_accuracy=0.98, cnn_val_accuracy=0.98, mlp_params=76_330, cnn_params=80_602)
        == "mlp"
    )
    # tie with reversed parameter counts still picks the smaller model
    assert (
        select_nominated_model(mlp_val_accuracy=0.98, cnn_val_accuracy=0.98, mlp_params=90_000, cnn_params=80_602)
        == "cnn"
    )


def test_metrics_written_to_disk_round_trip(tmp_path):
    from mnist_light.train import validate_metrics, write_metrics

    metrics = sample_metrics()
    for model in ("mlp", "cnn"):
        metrics["models"][model]["epochs"] = [
            {"epoch": e, "train_loss": 0.2, "val_accuracy": 0.9, "train_sec": 1.0, "val_sec": 0.1}
            for e in range(1, 4)
        ]
        metrics["models"][model]["final_val_accuracy"] = 0.9
        metrics["models"][model]["test_accuracy"] = 0.9
    metrics["nominated_model"] = "cnn"
    metrics["timings_sec"] = {"total": 1.0}
    metrics["test_evaluations"] = {"count": 1, "stage": "final"}

    out = tmp_path / "metrics.json"
    write_metrics(metrics, out)
    loaded = json.loads(out.read_text())
    validate_metrics(loaded)
    assert loaded["experiment_id"] == "EXP-0001"


# ---------------------------------------------------------------------------
# CLI surface used by RUN.json
# ---------------------------------------------------------------------------


def test_train_cli_accepts_config_and_output_flags():
    from mnist_light.train import parse_args

    args = parse_args(["--config", "configs/exp0001.json", "--output", "outputs/EXP-0001/metrics.json"])
    assert args.config == "configs/exp0001.json"
    assert args.output == "outputs/EXP-0001/metrics.json"


def test_train_cli_does_not_expose_download_flag():
    from mnist_light.train import parse_args

    args = parse_args(["--config", "configs/exp0001.json", "--output", "out.json"])
    assert getattr(args, "download", False) is False
