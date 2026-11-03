"""Runs the tests in a fixed pseudo-random order: HIDDEN_SEED=<n> pytest -p shuffle_plugin. Same seed, same order."""
import os
import random


def pytest_collection_modifyitems(config, items):
    seed = os.environ.get("HIDDEN_SEED")
    if seed:
        items.sort(key=lambda item: item.nodeid)  # a canonical starting point, whatever order they were collected in
        random.Random(int(seed)).shuffle(items)
