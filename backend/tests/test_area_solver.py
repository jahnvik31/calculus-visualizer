import math

import pytest

from backend.area_solver import (
    area_between_curves,
    area_under_curve,
    parse_expression,
    solve_area_between_curves,
)


def test_area_under_curve_quadratic():
    value = area_under_curve("x**2", 0, 2)
    assert math.isclose(value, 8.0 / 3.0, rel_tol=1e-9)


def test_area_between_curves_parabola_and_line():
    value = area_between_curves("x**2", "x", 0, 1)
    assert math.isclose(value, 1.0 / 6.0, rel_tol=1e-9)


def test_solver_returns_steps_and_area():
    result = solve_area_between_curves("x**2", "x", 0, 1)
    assert result["intersections"] == [0.0, 1.0]
    assert len(result["steps"]) >= 4
    assert math.isclose(result["area"], 1.0 / 6.0, rel_tol=1e-9)
    assert len(result["plot"]) > 2


def test_area_is_split_at_crossing_inside_interval():
    result = solve_area_between_curves("x", "0", -1, 1)
    assert len(result["intervals"]) == 2
    assert math.isclose(result["area"], 1.0, rel_tol=1e-9)


def test_rejects_python_execution_syntax():
    with pytest.raises(ValueError, match="Unsupported function syntax"):
        parse_expression("__import__('os').system('echo unsafe')")


def test_rejects_reversed_bounds():
    with pytest.raises(ValueError, match="lower bound"):
        area_between_curves("x", "0", 2, 1)
