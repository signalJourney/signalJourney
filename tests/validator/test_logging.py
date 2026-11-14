"""Tests that the package logs on its own logger and prints nothing."""

import logging
from importlib import resources
from pathlib import Path

from signaljourney_validator import Validator

EXAMPLE = "examples/simple_pipeline.json"


def packaged_schema_root() -> Path:
    return Path(str(resources.files("signaljourney_validator") / "schema"))


def test_construction_prints_nothing(capsys):
    Validator()
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""


def test_construction_logs_on_the_package_logger(caplog):
    with caplog.at_level(logging.DEBUG, logger="signaljourney_validator"):
        Validator()
    records = [r for r in caplog.records if r.name == "signaljourney_validator"]
    assert any("Inlining" in r.getMessage() for r in records)
    assert all(r.levelno == logging.DEBUG for r in records)


def test_bids_context_notice_is_logged_not_printed(tmp_path, capsys, caplog):
    validator = Validator()
    example = packaged_schema_root() / EXAMPLE
    with caplog.at_level(logging.INFO, logger="signaljourney_validator"):
        validator.validate(example, raise_exceptions=False, bids_context=tmp_path)
    assert capsys.readouterr().out == ""
    assert any("BIDS context validation" in r.getMessage() for r in caplog.records)
