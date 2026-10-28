import math

import pytest

from backend.area_solver import (
    area_between_curves,
    area_under_curve,
    parse_expression,
    solve_area_between_curves,
    solve_volume_of_revolution,
)
from backend.double_integral_solver import solve_double_integral


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


def test_volume_about_x_axis_uses_disks_and_highlights_a_slice():
    result = solve_volume_of_revolution("x", "0", "x", 0, 1)
    assert math.isclose(result["volume"], math.pi / 3, rel_tol=1e-9)
    assert result["sections"][0]["method"] == "disk"
    assert result["representative_slice"]["outer_radius"] > 0
    assert result["representative_slice"]["inner_radius"] == 0


def test_volume_about_y_axis_uses_washers_and_y_variable():
    result = solve_volume_of_revolution("2", "1", "y", 0, 3)
    assert math.isclose(result["volume"], 9 * math.pi, rel_tol=1e-9)
    assert result["sections"][0]["method"] == "washer"
    assert result["variable"] == "y"


def test_volume_splits_when_region_crosses_rotation_axis():
    result = solve_volume_of_revolution("x", "0", "x", -1, 1)
    assert len(result["sections"]) == 2
    assert math.isclose(result["volume"], 2 * math.pi / 3, rel_tol=1e-9)


def test_double_integral_derives_reversed_limits_for_triangle():
    result = solve_double_integral("x + y", "x", "2 - x", 0, 1)

    assert len(result["steps"]) >= 8
    assert len(result["plot"]) > 2
    assert math.isclose(result["dy_first_value"], 4 / 3, rel_tol=1e-9)
    assert math.isclose(result["dx_first_value"], result["dy_first_value"], rel_tol=1e-9)
    assert "∫[0, 1]" in result["dx_first_setup"]
    assert "∫[1, 2]" in result["dx_first_setup"]


def test_double_integral_rejects_curved_region_boundaries():
    with pytest.raises(ValueError, match="straight-line boundaries"):
        solve_double_integral("1", "x**2", "1", 0, 1)
