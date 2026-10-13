"""Smoke tests for the initial CORTANA-Agent package scaffold."""

from cortana import __version__


def test_package_has_version() -> None:
    assert __version__ == "0.1.0"


def test_version_is_nonempty() -> None:
    assert isinstance(__version__, str)
    assert __version__.strip()
