"""CI runs the suite in random order to catch tests that depend on each other (docs/testing.md).

CI_SHUFFLE_SEED=<number> pytest   runs the tests in the order that seed gives, and prints the seed in the header.
"""
import os
import random


def pytest_collection_modifyitems(config, items):
    seed = os.environ.get("CI_SHUFFLE_SEED")
    if seed:
        random.Random(int(seed)).shuffle(items)


def pytest_report_header(config):
    seed = os.environ.get("CI_SHUFFLE_SEED")
    return f"shuffle seed: {seed}" if seed else None
