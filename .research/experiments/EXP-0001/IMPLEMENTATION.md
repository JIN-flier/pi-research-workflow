# IMPLEMENTATION

- Experiment: EXP-0001
- Approved plan commit: `b71c3fe135362856f950392eb395963c55c8543f`
- Approved plan SHA256: `da7401c5b07e169ed9fa4d5e2ef137c44eee281dda0dfb78ef82a8579f52f2c3`
- Branch: `codex/exp-0001-implementation`
- Implementation commit: `b578aef217891d13d15697547562fdcb07d7a859`
- Implementation model: `deepseek/deepseek-flash`
- Workflow state after `record-implementation`: `CODE_REVIEW`

## Files changed (single commit)

| File | Purpose |
| --- | --- |
| `pyproject.toml` | uv project; Python 3.12; CPU-only `pytorch-cpu` index for torch/torchvision; pytest dev group |
| `.python-version` | `3.12` |
| `uv.lock` | frozen lockfile (torch 2.15.0+cpu, torchvision 0.29.2+cpu, numpy 2.5.4, pytest 9.2.0; zero nvidia packages) |
| `.gitignore` | added `data/` and `.pytest_cache/` |
| `configs/exp0001.json` | approved hyperparameters: seed 42, 3 epochs, batch 128, Adam lr 1e-3 / betas (0.9,0.999) / eps 1e-8 / wd 0, split seed 42 + 60,000/55,000/5,000, normalization 0.1307/0.3081, threads 2, cap 100,000, one test stage |
| `mnist_light/__init__.py` | package marker |
| `mnist_light/data.py` | fixed split + digest, normalization, `download=False` loaders, `TestSetGuard` |
| `mnist_light/models.py` | MLP/CNN builders, `set_seed`, exact parameter-count assertions, `parameter_audit` |
| `mnist_light/train.py` | formal entry point: training loop, validation per epoch, nomination, single final test phase, metrics contract + validation, `--config/--output` CLI |
| `mnist_light/prepare.py` | one-time MNIST download (`--data-dir`), no training, no label statistics |
| `tests/test_mnist_light.py` | 30 unit tests (30 passed) |

Not committed (per instructions): `.research/STATE.md`, `PLAN_REVIEW.md`, this file, `data/`, `.venv/`.

## Plan conformance

- Split: `np.random.default_rng(42).permutation(60_000)`; first 5,000 -> validation, rest -> train (55,000). Disjoint, exhaustive over 0..59,999, reproducible. Digest `0ef54ee88bc129d746cc37af6bb576121ce2cf8fac61d4c7f467b55e26c744af` (SHA256 over int64 index bytes), written to metrics.
- Models: MLP `Flatten→Linear(784,96)→ReLU→Linear(96,10)` = 76,330 params; CNN `Conv(1,16,3,p=1)→ReLU→Pool→Conv(16,32,3,p=1)→ReLU→Pool→Flatten(1568)→Linear(1568,48)→ReLU→Linear(48,10)` = 80,602 params. Counts asserted at build and pinned by tests; both ≤ 100,000.
- Training: `set_seed(42)` before every build; Adam lr 1e-3, betas (0.9,0.999), eps 1e-8, wd 0; CrossEntropyLoss; batch 128; per-epoch reshuffle via `SubsetRandomSampler` with a `torch.Generator` seeded `seed + epoch`; `num_workers=0`; exactly 3 epochs per model; validation after every epoch; nomination by final validation accuracy with fewer-parameters tie-break.
- Runtime: `torch.set_num_threads(2)`, `OMP_NUM_THREADS`/`MKL_NUM_THREADS` defaulted to 2 before torch import (RUN.json exports them as well), `torch.use_deterministic_algorithms(True)`.
- Test protocol: `TestSetGuard` allows exactly one successful test-set read; no test data is touched before the final phase; both fixed models are evaluated once in that phase; a failed construction does not consume the read; `assert_read_once()` plus `validate_metrics` end the run with a hard failure if the read count is not exactly 1.
- Data access: `download=False` everywhere; missing `data/MNIST/raw` raises `FileNotFoundError` pointing at `python -m mnist_light.prepare --data-dir data` (verified: no output file, no download).
- Metrics JSON fields: `experiment_id, git_commit, seed, versions, threads, parameter_counts, split_digest, split_sizes, epochs, batch_size, models{parameters,epochs[train_loss,val_accuracy,train_sec,val_sec],final_val_accuracy,test_accuracy}, nominated_model, test_evaluations{count,stage,models}, timings_sec{setup,train_mlp,train_cnn,final_test,total}, peak_rss_mb`.
- `RUN.json` command compatibility: `python -m mnist_light.train --config configs/exp0001.json --output outputs/EXP-0001/metrics.json` parses unchanged; only `--config`/`--output` are accepted (no `--download` flag).

## Test-first evidence

1. Tests written before any implementation; run: `uv run --frozen pytest tests/test_mnist_light.py` -> **30 failed in 0.91 s**, every failure `ModuleNotFoundError: No module named 'mnist_light'` (log: `/tmp/exp0001-impl-evidence/tests-failing.txt`).
2. After implementation: `uv run --frozen pytest tests/test_mnist_light.py -v` -> **30 passed in 1.62 s** (log: `/tmp/exp0001-impl-evidence/tests-passing.txt`).
   - One intermediate failure was a bug in the test itself (arguments to `select_nominated_model` passed positionally in the wrong order); the test was corrected to keyword arguments and an extra tie case was added. No production code was weakened to fit a test.
3. Existing Node workflow tests unchanged: `node --test tests/*.test.mjs` -> 14 pass, 0 fail.
4. Non-formal smoke checks against the real local MNIST data (no training, no test-set access). These checks were **not** all green on the first attempt:
   - First real-data batch fetch raised `IndexError: list index out of range` from `torch/utils/data/dataset.py` (`Subset.__getitems__`). Root cause: the training loader was built as `DataLoader(Subset(dataset, list(indices)), sampler=SubsetRandomSampler(list(indices)))`, i.e. the sampler yielded the already-subset absolute MNIST indices while the `Subset` wrapper indexed them a second time. The unit tests did not catch this because they did not load real MNIST or iterate a real loader; all 30 unit tests were passing at that moment.
   - Fix made by the worker before the implementation commit: pass the full dataset to `DataLoader` when using `SubsetRandomSampler(list(indices))`, so the sampler performs the single index mapping. The evaluation loader keeps `Subset(dataset, list(indices))` with `shuffle=False`.
   - Re-run checks after the fix: train split/dataset lengths 60,000 -> 55,000/5,000, one 128-image train batch `(128,1,28,28)`/`(128,)`, one 128-image validation batch, per-epoch reshuffle differs across epochs, missing-data path fails cleanly. The official test set was not constructed in any of these checks.
   - This is recorded as a real implementation defect found by a data-loading smoke check, not as a clean first-pass implementation. The committed loader is the fixed version; the unit-test blind spot (no real-data loader iteration) remains a known test-coverage limitation.
5. `uv sync --frozen --offline` and `uv run --frozen --offline python -c "import mnist_light..."` both succeed, i.e. the frozen lockfile needs no network after the initial install.

## Measured preparation cost (outside the formal run)

- `uv lock`: 28.5 s wall (metadata resolution only).
- First `uv sync --frozen` (Python 3.12 + CPU wheels): **35.7 s** wall; `~/.cache/uv` grew from 36 MiB to 924 MiB (~+888 MiB downloaded/unpacked); `.venv` is 887 MiB. `torch.cuda.is_available()` is `False`, `uv.lock` contains no `nvidia` entries.
- `uv run --frozen python -m mnist_light.prepare --data-dir data`: **17.2 s** wall (15.2 s in-process), downloaded compressed files 11,594,722 bytes (11.1 MiB); `data/MNIST/raw` occupies 63.5 MiB after torchvision extraction.

## Outstanding risks / limitations

- CPU determinism is best-effort: deterministic algorithms and seeded RNGs are on, but results are still a single run/seed and cross-machine bitwise equality is not guaranteed.
- The wall-clock budget (30 min hard timeout in `RUN.json`) has not been validated end-to-end, since formal training outside the gated `run` command was forbidden. Per-epoch cost is unmeasured.
- `torch.use_deterministic_algorithms(True)` can raise at runtime for some ops; all ops used here (conv/pool/linear/CE on CPU) are expected to be deterministic, but this is unproven until the formal run.
- `prepare.py` leaves both `.gz` and extracted idx files in `data/MNIST/raw`; `require_raw_data` accepts either form, so a torchvision version that deletes the `.gz` files after extraction stays compatible.
- The data directory is a local, unversioned prerequisite: a fresh clone must run `prepare` before the formal run, otherwise the run fails fast (by design).
- The package is installed editable, so the venv tracks the working tree; the formal run must use HEAD == `b578aef`.
