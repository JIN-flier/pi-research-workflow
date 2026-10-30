"""Tests for EXP-0001 ``src/summation_demo.py`` (approved plan: PLAN.md)."""

from __future__ import annotations

import contextlib
import io
import json
import math
import sys
import unittest
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src import summation_demo  # noqa: E402


class FixedInputTests(unittest.TestCase):
    """The dataset is fixed by the plan and must not drift."""

    def test_samples_match_the_plan_table(self):
        expected = [
            ("control", [1.0, 2.0, 3.0], 6),
            ("cancellation_one", [1e16, 1.0, -1e16], 1),
            ("cancellation_two", [1e16, 1.0, 1.0, -1e16], 2),
        ]
        observed = [
            (sample["name"], sample["inputs"], sample["exact_sum"])
            for sample in summation_demo.SAMPLES
        ]
        self.assertEqual(observed, expected)

    def test_exact_sums_are_exact_integer_arithmetic(self):
        # Independent check: Fraction(float) is the exact binary value, so the
        # exact sum needs no floating-point rounding.
        for sample in summation_demo.SAMPLES:
            exact = sum(Fraction(value) for value in sample["inputs"])
            self.assertEqual(exact, Fraction(sample["exact_sum"]))

    def test_inputs_are_not_modified(self):
        before = [list(sample["inputs"]) for sample in summation_demo.SAMPLES]
        summation_demo.build_report()
        after = [list(sample["inputs"]) for sample in summation_demo.SAMPLES]
        self.assertEqual(before, after)

        values = [1e16, 1.0, -1e16]
        summation_demo.naive_sum(values)
        summation_demo.candidate_sum(values)
        self.assertEqual(values, [1e16, 1.0, -1e16])

    def test_functions_accept_immutable_sequences(self):
        values = (1e16, 1.0, -1e16)
        self.assertEqual(summation_demo.naive_sum(values), 0.0)
        self.assertEqual(summation_demo.candidate_sum(values), 1.0)


class BaselineTests(unittest.TestCase):
    def test_naive_sum_is_a_zero_initialised_ordered_accumulation(self):
        self.assertEqual(summation_demo.naive_sum([]), 0.0)
        self.assertEqual(summation_demo.naive_sum([2.0, 3.0]), 5.0)
        # 1e16 + 1.0 rounds back to 1e16, so ordered accumulation from 0.0
        # loses the 1.0 and cancels to 0.0. This value is what distinguishes the
        # plan's baseline from math.fsum (1.0) and from a sorted/reordered sum.
        self.assertEqual(summation_demo.naive_sum([1e16, 1.0, -1e16]), 0.0)
        self.assertNotEqual(summation_demo.naive_sum([1e16, 1.0, -1e16]), 1.0)
        # Order matters: cancelling before adding the small term keeps it.
        self.assertEqual(summation_demo.naive_sum([1e16, -1e16, 1.0]), 1.0)

    def test_baseline_is_not_builtin_sum_or_fsum(self):
        self.assertIsNot(summation_demo.naive_sum, sum)
        self.assertIsNot(summation_demo.naive_sum, summation_demo.candidate_sum)

    def test_candidate_uses_math_fsum(self):
        values = [1e16, 1.0, -1e16]
        self.assertEqual(summation_demo.candidate_sum(values), math.fsum(values))


class ErrorMetricTests(unittest.TestCase):
    def test_absolute_error_is_abs_result_minus_exact(self):
        self.assertEqual(summation_demo.absolute_error(6.0, 6), 0.0)
        self.assertEqual(summation_demo.absolute_error(1.5, 1), 0.5)
        self.assertEqual(summation_demo.absolute_error(0, 2), 2.0)

    def test_every_report_error_matches_abs_difference(self):
        report = summation_demo.build_report()
        for record in report["samples"]:
            self.assertEqual(
                record["baseline_error"],
                abs(record["baseline_result"] - record["exact_sum"]),
            )
            self.assertEqual(
                record["candidate_error"],
                abs(record["candidate_result"] - record["exact_sum"]),
            )
            self.assertGreaterEqual(record["baseline_error"], 0.0)
            self.assertGreaterEqual(record["candidate_error"], 0.0)


class SupportedFlagTests(unittest.TestCase):
    @staticmethod
    def record(strict, baseline_error, candidate_error):
        return {
            "requires_strict_improvement": strict,
            "baseline_error": baseline_error,
            "candidate_error": candidate_error,
        }

    def test_strict_samples_require_strict_improvement(self):
        self.assertTrue(summation_demo.is_supported([self.record(True, 1.0, 0.0)]))
        self.assertFalse(summation_demo.is_supported([self.record(True, 1.0, 1.0)]))
        self.assertFalse(summation_demo.is_supported([self.record(True, 0.0, 1.0)]))

    def test_control_only_requires_no_regression(self):
        self.assertTrue(summation_demo.is_supported([self.record(False, 0.0, 0.0)]))
        self.assertTrue(summation_demo.is_supported([self.record(False, 0.5, 0.0)]))
        self.assertFalse(summation_demo.is_supported([self.record(False, 0.0, 0.5)]))

    def test_one_failing_sample_blocks_support(self):
        records = [
            self.record(False, 0.0, 0.0),
            self.record(True, 1.0, 0.0),
            self.record(True, 1.0, 1.0),
        ]
        self.assertFalse(summation_demo.is_supported(records))
        self.assertTrue(summation_demo.is_supported(records[:2]))

    def test_report_supported_recomputes_from_observed_errors(self):
        report = summation_demo.build_report()
        expected = True
        for record in report["samples"]:
            if record["requires_strict_improvement"]:
                expected = expected and record["candidate_error"] < record["baseline_error"]
            else:
                expected = expected and record["candidate_error"] <= record["baseline_error"]
        self.assertIs(report["supported"], expected)


class OutputContractTests(unittest.TestCase):
    def test_main_prints_one_json_object_and_exits_zero(self):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            status = summation_demo.main()
        self.assertEqual(status, 0)

        report = json.loads(buffer.getvalue())
        self.assertEqual(report["experiment_id"], "EXP-0001")
        self.assertEqual(report["python_version_info"], list(sys.version_info[:3]))
        self.assertIn(report["python_version"], sys.version)
        self.assertIsInstance(report["supported"], bool)

        names = [record["name"] for record in report["samples"]]
        self.assertEqual(names, ["control", "cancellation_one", "cancellation_two"])
        for record in report["samples"]:
            self.assertIsInstance(record["exact_sum"], int)
            self.assertIsInstance(record["baseline_result"], float)
            self.assertIsInstance(record["candidate_result"], float)
            self.assertTrue(record["inputs_unchanged"])

    def test_report_is_json_serialisable_in_one_call(self):
        report = summation_demo.build_report()
        self.assertEqual(json.loads(json.dumps(report)), report)


if __name__ == "__main__":
    unittest.main()
