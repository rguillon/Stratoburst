"""Executable repository conventions (CLAUDE.md coding standards)."""

import ast
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
TESTS = ROOT / "tests"
CORE = SRC / "scorched_core"

CONSTANTS_ONLY = {"src/scorched_core/protocol.py", "src/scorched_core/tuning.py"}
FORBIDDEN_CORE_IMPORTS = {"js", "pyodide", "time", "datetime"}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


SRC_MODULES = sorted(SRC.rglob("*.py"))
CORE_MODULES = sorted(CORE.rglob("*.py"))
SRC_NON_INIT = [p for p in SRC_MODULES if p.name != "__init__.py"]
NEEDS_MIRROR = [p for p in SRC_NON_INIT if rel(p) not in CONSTANTS_ONLY]
TEST_MODULES = sorted(p for p in TESTS.rglob("test_*.py") if p.name != "test_conventions.py")


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def snake_case(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def imported_roots(tree: ast.Module) -> set[str]:
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots.add(node.module.split(".")[0])
    return roots


@pytest.mark.parametrize("path", CORE_MODULES, ids=rel)
def test_core_is_pure(path: Path) -> None:
    bad = imported_roots(parse(path)) & FORBIDDEN_CORE_IMPORTS
    assert not bad, f"{rel(path)} imports forbidden module(s): {sorted(bad)}"


@pytest.mark.parametrize("path", SRC_MODULES, ids=rel)
def test_one_class_per_file_named_after_the_file(path: Path) -> None:
    classes = [n for n in parse(path).body if isinstance(n, ast.ClassDef)]
    assert len(classes) <= 1, f"{rel(path)} defines {len(classes)} top-level classes"
    if classes:
        assert snake_case(classes[0].name) == path.stem, (
            f"{rel(path)}: class {classes[0].name} should live in {snake_case(classes[0].name)}.py"
        )


@pytest.mark.parametrize("path", NEEDS_MIRROR, ids=rel)
def test_module_has_mirrored_test(path: Path) -> None:
    mirrored = TESTS / path.relative_to(SRC).parent / f"test_{path.stem}.py"
    assert mirrored.is_file(), f"{rel(path)} has no mirrored test at {rel(mirrored)}"


@pytest.mark.parametrize("name", sorted(CONSTANTS_ONLY))
def test_constants_only_allow_list_is_honest(name: str) -> None:
    tree = parse(ROOT / name)
    defs = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef | ast.ClassDef)]
    assert not defs, f"{name} is on the constants-only allow-list but defines {len(defs)} def(s)"


@pytest.mark.parametrize("path", TEST_MODULES, ids=rel)
def test_no_orphan_tests(path: Path) -> None:
    source = SRC / path.relative_to(TESTS).parent / (path.stem.removeprefix("test_") + ".py")
    assert source.is_file(), f"{rel(path)} has no matching source module {rel(source)}"
