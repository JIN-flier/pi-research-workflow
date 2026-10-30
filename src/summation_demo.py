"""EXP-0001 teaching demo: naive left-to-right accumulation vs ``math.fsum``.

The inputs are fixed by the approved plan
(``.research/experiments/EXP-0001/PLAN.md``): no randomness, no data
splitting, no repetitions. The program writes one JSON object to stdout and
exits with status 0 even when the hypothesis is not supported; a non-zero exit
status means the program itself failed.
"""

from __future__ import annotations

import json
import math
import sys

BASELINE_METHOD = "total = 0.0; then total += x for x in inputs, in input order"
CANDIDATE_METHOD = "math.fsum(inputs)"

# Fixed inputs from the approved plan. ``exact_sum`` is the mathematically exact
# sum, an integer here because every listed value is exactly representable and
# the sums are small. ``requires_strict_improvement`` encodes the plan's
# metrics: the two cancellation samples must improve strictly, the control must
# not get worse.
SAMPLES = (
    {
        "name": "control",
        "inputs": [1.0, 2.0, 3.0],
        "exact_sum": 6,
        "requires_strict_improvement": False,
    },
    {
        "name": "cancellation_one",
        "inputs": [1e16, 1.0, -1e16],
        "exact_sum": 1,
        "requires_strict_improvement": True,
    },
    {
        "name": "cancellation_two",
        "inputs": [1e16, 1.0, 1.0, -1e16],
        "exact_sum": 2,
        "requires_strict_improvement": True,
    },
)


def naive_sum(values):
    """Baseline: start at 0.0 and add each term in input order."""
    total = 0.0
    for value in values:
        total += value
    return total


def candidate_sum(values):
    """Candidate: ``math.fsum`` over the same values in the same order."""
    return math.fsum(values)


def absolute_error(result, exact_sum):
    """Absolute error of ``result`` against the exactly known sum."""
    return abs(result - exact_sum)


def is_supported(records):
    """Decide support from the observed errors only.

    A sample flagged ``requires_strict_improvement`` supports the hypothesis only
    if the candidate error is strictly smaller; any other sample must not be
    worse. The hypothesis holds only if every record agrees.
    """
    for record in records:
        if record["requires_strict_improvement"]:
            if not record["candidate_error"] < record["baseline_error"]:
                return False
        elif record["candidate_error"] > record["baseline_error"]:
            return False
    return True


def evaluate_sample(sample):
    """Evaluate one fixed sample without mutating the sample's input list."""
    inputs = list(sample["inputs"])
    exact_sum = sample["exact_sum"]

    baseline_result = naive_sum(inputs)
    candidate_result = candidate_sum(inputs)

    return {
        "name": sample["name"],
        "inputs": list(inputs),
        "inputs_unchanged": inputs == list(sample["inputs"]),
        "exact_sum": exact_sum,
        "baseline_result": baseline_result,
        "baseline_error": absolute_error(baseline_result, exact_sum),
        "candidate_result": candidate_result,
        "candidate_error": absolute_error(candidate_result, exact_sum),
        "requires_strict_improvement": sample["requires_strict_improvement"],
        "candidate_strictly_better": absolute_error(candidate_result, exact_sum)
        < absolute_error(baseline_result, exact_sum),
    }


def build_report():
    """Build the full JSON-serialisable report for the fixed samples."""
    records = [evaluate_sample(sample) for sample in SAMPLES]
    return {
        "experiment_id": "EXP-0001",
        "python_version": sys.version.split()[0],
        "python_version_info": list(sys.version_info[:3]),
        "baseline_method": BASELINE_METHOD,
        "candidate_method": CANDIDATE_METHOD,
        "samples": records,
        "supported": is_supported(records),
    }


def main():
    report = build_report()
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
