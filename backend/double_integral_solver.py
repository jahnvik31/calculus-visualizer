"""Step-by-step double-integral solutions for regions between affine curves."""

from __future__ import annotations

import math
from typing import Any

import sympy as sp

from backend.area_solver import X, Y, _real_float, _validate_bounds, parse_expression


def _format_number(value: float) -> str:
    return f"{value:.8g}"


def _integral(expression: sp.Expr, *limits: tuple[sp.Symbol, Any, Any]) -> float:
    return _real_float(sp.integrate(expression, *limits), "Double integral")


def solve_double_integral(
    integrand: str,
    lower_function: str,
    upper_function: str,
    x_lower: float,
    x_upper: float,
) -> dict[str, Any]:
    """Evaluate a double integral and reverse its order for affine y-boundaries."""
    x_min, x_max = _validate_bounds(x_lower, x_upper)
    function = parse_expression(integrand, "xy")
    lower = parse_expression(lower_function)
    upper = parse_expression(upper_function)
    try:
        lower_poly, upper_poly = sp.Poly(lower, X), sp.Poly(upper, X)
    except sp.PolynomialError as exc:
        raise ValueError("For changing the order, enter straight-line boundaries in x.") from exc
    if lower_poly.degree() > 1 or upper_poly.degree() > 1:
        raise ValueError("For changing the order, enter straight-line boundaries in x.")

    lower_slope = _real_float(sp.diff(lower, X), "Lower boundary slope")
    upper_slope = _real_float(sp.diff(upper, X), "Upper boundary slope")
    lower_intercept = _real_float(lower.subs(X, 0), "Lower boundary")
    upper_intercept = _real_float(upper.subs(X, 0), "Upper boundary")
    for x_value in (x_min, x_max):
        if _real_float((upper - lower).subs(X, x_value), "Region height") < -1e-9:
            raise ValueError("The upper y-boundary must stay above the lower y-boundary.")

    x_value = _integral(
        function,
        (Y, lower, upper),
        (X, x_min, x_max),
    )
    breaks = {
        _real_float(expression.subs(X, endpoint), "Region boundary")
        for expression in (lower, upper)
        for endpoint in (x_min, x_max)
    }
    if not math.isclose(lower_slope, upper_slope, abs_tol=1e-12):
        crossing = (upper_intercept - lower_intercept) / (lower_slope - upper_slope)
        if x_min < crossing < x_max:
            raise ValueError("The lower and upper boundaries cross inside the x interval.")

    y_segments: list[dict[str, Any]] = []
    ordered_breaks = sorted(breaks)
    for y_start, y_end in zip(ordered_breaks, ordered_breaks[1:]):
        y_mid = (y_start + y_end) / 2
        candidates: list[tuple[float, sp.Expr]] = [(x_min, sp.Float(x_min)), (x_max, sp.Float(x_max))]
        for slope, intercept in ((lower_slope, lower_intercept), (upper_slope, upper_intercept)):
            if math.isclose(slope, 0, abs_tol=1e-12):
                continue
            inverse = (Y - intercept) / slope
            at_midpoint = _real_float(inverse.subs(Y, y_mid), "Reversed boundary")
            if x_min + 1e-9 < at_midpoint < x_max - 1e-9:
                candidates.append((at_midpoint, inverse))
        candidates.sort(key=lambda candidate: candidate[0])

        for (left_mid, left_expr), (right_mid, right_expr) in zip(candidates, candidates[1:]):
            x_mid = (left_mid + right_mid) / 2
            lower_mid = lower_slope * x_mid + lower_intercept
            upper_mid = upper_slope * x_mid + upper_intercept
            if lower_mid - 1e-9 <= y_mid <= upper_mid + 1e-9:
                y_segments.append(
                    {
                        "lower": y_start,
                        "upper": y_end,
                        "left": left_expr,
                        "right": right_expr,
                    }
                )

    if not y_segments:
        raise ValueError("Could not derive reversed limits for this region.")

    y_value = sum(
        _integral(function, (X, segment["left"], segment["right"]), (Y, segment["lower"], segment["upper"]))
        for segment in y_segments
    )
    if not math.isclose(x_value, y_value, rel_tol=1e-8, abs_tol=1e-8):
        raise ValueError("The two integration orders did not agree; try a simpler region or integrand.")

    y_min = min(segment["lower"] for segment in y_segments)
    y_max = max(segment["upper"] for segment in y_segments)
    sample_count = 80
    plot = [
        {
            "x": x_min + (x_max - x_min) * index / sample_count,
            "lower": _real_float(lower.subs(X, x_min + (x_max - x_min) * index / sample_count), "Lower boundary"),
            "upper": _real_float(upper.subs(X, x_min + (x_max - x_min) * index / sample_count), "Upper boundary"),
        }
        for index in range(sample_count + 1)
    ]

    representative = max(y_segments, key=lambda segment: (segment["upper"] - segment["lower"]) * (x_max - x_min))
    y_midpoint = (representative["lower"] + representative["upper"]) / 2
    x_left = _real_float(representative["left"].subs(Y, y_midpoint), "Left reversed boundary")
    x_right = _real_float(representative["right"].subs(Y, y_midpoint), "Right reversed boundary")
    x_midpoint = (x_min + x_max) / 2
    x_strip = {
        "x": x_midpoint,
        "lower": _real_float(lower.subs(X, x_midpoint), "Lower boundary"),
        "upper": _real_float(upper.subs(X, x_midpoint), "Upper boundary"),
    }
    y_strip = {"y": y_midpoint, "left": x_left, "right": x_right}
    x_setup = (
        f"∫[{_format_number(x_min)}, {_format_number(x_max)}] "
        f"∫[{sp.sstr(lower)} to {sp.sstr(upper)}] ({sp.sstr(function)}) dy dx"
    )
    y_setup = " + ".join(
        f"∫[{_format_number(segment['lower'])}, {_format_number(segment['upper'])}] "
        f"∫[{sp.sstr(segment['left'])} to {sp.sstr(segment['right'])}] ({sp.sstr(function)}) dx dy"
        for segment in y_segments
    )
    steps = [
        f"The region is {_format_number(x_min)} ≤ x ≤ {_format_number(x_max)} with "
        f"{sp.sstr(lower)} ≤ y ≤ {sp.sstr(upper)}.",
        "Integrating with respect to y first: keep x fixed and sweep a vertical strip through the region.",
        f"Limits: {_format_number(x_min)} ≤ x ≤ {_format_number(x_max)} and "
        f"{sp.sstr(lower)} ≤ y ≤ {sp.sstr(upper)}; setup: {x_setup}.",
        f"Evaluate the vertical-strip integral: {_format_number(x_value)}.",
        "For the reversed order, project the region onto the y-axis and split wherever a boundary meets an x endpoint.",
        *[
            f"For {_format_number(segment['lower'])} ≤ y ≤ {_format_number(segment['upper'])}, "
            f"x runs from {sp.sstr(segment['left'])} to {sp.sstr(segment['right'])}."
            for segment in y_segments
        ],
        f"Limits and setup for horizontal strips: {y_setup}.",
        f"Evaluate the horizontal-strip integral: {_format_number(y_value)}.",
        "Both orders agree.",
    ]
    return {
        "bounds": [x_min, x_max],
        "y_bounds": [y_min, y_max],
        "integrand": sp.sstr(function),
        "lower_curve": sp.sstr(lower),
        "upper_curve": sp.sstr(upper),
        "plot": plot,
        "dy_first_value": x_value,
        "dx_first_value": y_value,
        "dy_first_setup": x_setup,
        "dx_first_setup": y_setup,
        "x_strip": x_strip,
        "y_strip": y_strip,
        "steps": steps,
    }
