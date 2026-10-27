"""Safe symbolic helpers for area-under- and area-between-curves problems."""

from __future__ import annotations

import ast
import math
import operator
from typing import Any

import sympy as sp

X = sp.Symbol("x", real=True)
MAX_EXPRESSION_LENGTH = 128
MAX_EXPONENT = 12
FUNCTIONS = {
    "abs": sp.Abs,
    "cos": sp.cos,
    "exp": sp.exp,
    "log": sp.log,
    "sin": sp.sin,
    "sqrt": sp.sqrt,
    "tan": sp.tan,
}
CONSTANTS = {"pi": sp.pi, "e": sp.E}
OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}


def parse_expression(expression: str, variable: str = "x") -> sp.Expr:
    """Parse a small arithmetic expression without evaluating arbitrary Python."""
    if variable not in {"x", "y"}:
        raise ValueError("The variable must be x or y.")
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("Enter a function before solving.")
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise ValueError(f"Functions must be at most {MAX_EXPRESSION_LENGTH} characters.")

    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError("Function syntax is invalid. Use x, numbers, and basic math operators.") from exc

    def convert(node: ast.AST) -> sp.Expr:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            if not math.isfinite(float(node.value)):
                raise ValueError("Function constants must be finite.")
            return sp.sympify(node.value)
        if isinstance(node, ast.Name):
            if node.id == variable:
                return X
            if node.id in CONSTANTS:
                return CONSTANTS[node.id]
            raise ValueError(f"Unsupported name {node.id!r}. Use {variable}, pi, or e.")
        if isinstance(node, ast.BinOp) and type(node.op) in OPERATORS:
            left, right = convert(node.left), convert(node.right)
            if isinstance(node.op, ast.Pow):
                if not right.is_number or abs(float(right)) > MAX_EXPONENT:
                    raise ValueError(f"Exponents must be numeric and no greater than {MAX_EXPONENT} in magnitude.")
            return OPERATORS[type(node.op)](left, right)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = convert(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FUNCTIONS:
            if node.keywords:
                raise ValueError("Function calls cannot use keyword arguments.")
            return FUNCTIONS[node.func.id](*(convert(arg) for arg in node.args))
        raise ValueError("Unsupported function syntax. Use x, numbers, +, -, *, /, **, and basic math functions.")

    try:
        return sp.simplify(convert(tree.body))
    except (ArithmeticError, TypeError, ValueError) as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError("Function could not be evaluated.") from exc


def _expression(value: str | int | float | sp.Expr, label: str, variable: str = "x") -> sp.Expr:
    if isinstance(value, sp.Expr):
        return value
    if isinstance(value, (int, float)):
        if not math.isfinite(float(value)):
            raise ValueError(f"{label} must be finite.")
        return sp.sympify(value)
    try:
        return parse_expression(value, variable)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label}: {exc}") from exc


def _validate_bounds(a: float, b: float) -> tuple[float, float]:
    try:
        lower, upper = float(a), float(b)
    except (TypeError, ValueError) as exc:
        raise ValueError("Enter numeric lower and upper bounds.") from exc
    if not math.isfinite(lower) or not math.isfinite(upper):
        raise ValueError("Bounds must be finite numbers.")
    if lower >= upper:
        raise ValueError("The lower bound must be less than the upper bound.")
    if upper - lower > 1_000_000:
        raise ValueError("The interval is too wide. Use bounds no more than 1,000,000 units apart.")
    return lower, upper


def _real_float(value: Any, label: str) -> float:
    numeric = complex(sp.N(value))
    if abs(numeric.imag) > 1e-9 or not math.isfinite(numeric.real):
        raise ValueError(f"{label} is not finite and real on the selected interval.")
    return float(numeric.real)


def find_intersection_points(
    f_expr: str | int | float | sp.Expr,
    g_expr: str | int | float | sp.Expr,
    *,
    lower: float | None = None,
    upper: float | None = None,
) -> list[float]:
    """Return sorted real intersections, optionally restricted to a given interval."""
    difference = sp.simplify(_expression(f_expr, "First function") - _expression(g_expr, "Second function"))
    if difference == 0:
        return []

    try:
        candidates = sp.solve(difference, X)
    except (NotImplementedError, TypeError, ValueError):
        candidates = []
    if not candidates:
        try:
            candidates = sp.nroots(sp.Poly(difference, X), maxsteps=100)
        except (NotImplementedError, TypeError, ValueError, sp.PolynomialError):
            candidates = []

    roots: list[float] = []
    for candidate in candidates:
        try:
            root = _real_float(candidate, "Intersection")
        except (TypeError, ValueError):
            continue
        if lower is not None and root < lower - 1e-8:
            continue
        if upper is not None and root > upper + 1e-8:
            continue
        if not any(math.isclose(root, existing, abs_tol=1e-8) for existing in roots):
            roots.append(root)
    return sorted(roots)


def _integral(expression: sp.Expr, lower: float, upper: float) -> float:
    value = sp.integrate(expression, (X, lower, upper))
    return _real_float(value, "Integral")


def area_under_curve(function: str | int | float | sp.Expr, a: float, b: float) -> float:
    """Return the signed definite integral of a function over the interval."""
    lower, upper = _validate_bounds(a, b)
    return _integral(_expression(function, "Function"), lower, upper)


def _intervals(
    f: sp.Expr,
    g: sp.Expr,
    a: float | None,
    b: float | None,
) -> tuple[list[tuple[float, float]], list[float]]:
    if (a is None) != (b is None):
        raise ValueError("Enter both bounds, or leave both blank to use intersections.")
    if a is None:
        intersections = find_intersection_points(f, g)
        if len(intersections) < 2:
            raise ValueError("The functions need at least two real intersections when bounds are omitted.")
        lower, upper = intersections[0], intersections[-1]
    else:
        assert b is not None
        lower, upper = _validate_bounds(a, b)
        intersections = find_intersection_points(f, g, lower=lower, upper=upper)

    split_points = [lower, *(root for root in intersections if lower < root < upper), upper]
    return list(zip(split_points, split_points[1:])), intersections


def _area_solution(
    first: str | int | float | sp.Expr,
    second: str | int | float | sp.Expr,
    a: float | None = None,
    b: float | None = None,
) -> dict[str, Any]:
    f = _expression(first, "First function")
    g = _expression(second, "Second function")
    intervals, intersections = _intervals(f, g, a, b)

    sections: list[dict[str, Any]] = []
    total = 0.0
    for lower, upper in intervals:
        midpoint = (lower + upper) / 2
        f_mid = _real_float(f.subs(X, midpoint), "First function")
        g_mid = _real_float(g.subs(X, midpoint), "Second function")
        top, bottom = (f, g) if f_mid >= g_mid else (g, f)
        top_label, bottom_label = ("f(x)", "g(x)") if top is f else ("g(x)", "f(x)")
        integrand = sp.simplify(top - bottom)
        section_area = _integral(integrand, lower, upper)
        if section_area < -1e-8:
            raise ValueError("Unable to determine a nonnegative area for this interval.")
        section_area = max(0.0, section_area)
        total += section_area
        sections.append(
            {
                "lower": lower,
                "upper": upper,
                "top": top_label,
                "bottom": bottom_label,
                "integrand": sp.sstr(integrand),
                "area": section_area,
            }
        )

    if intersections:
        intersection_text = ", ".join(_format_number(root) for root in intersections)
        step_one = f"Set f(x) = g(x): {sp.sstr(sp.simplify(f - g))} = 0. The real intersections in the interval are x = {intersection_text}."
    else:
        step_one = f"Set f(x) = g(x): {sp.sstr(sp.simplify(f - g))} = 0. There are no intersections inside the selected bounds."

    integral_setup = " + ".join(
        f"∫[{_format_number(section['lower'])}, {_format_number(section['upper'])}] "
        f"({section['top']} − {section['bottom']}) dx"
        for section in sections
    )
    steps = [
        step_one,
        "Use the entered x-bounds and split the interval wherever the curves cross.",
        *[
            f"On [{_format_number(section['lower'])}, {_format_number(section['upper'])}], "
            f"{section['top']} is on top; height = {section['integrand']}."
            for section in sections
        ],
        f"Set up the area integral: {integral_setup}.",
        f"Evaluate each integral and add the positive areas: {_format_number(total)} square units.",
    ]

    plot_lower, plot_upper = intervals[0][0], intervals[-1][1]
    plot_x_values = {
        plot_lower + (plot_upper - plot_lower) * index / 120
        for index in range(121)
    }
    plot_x_values.update(intersections)
    plot: list[dict[str, float | None]] = []
    for x_value in sorted(plot_x_values):
        point: dict[str, float | None] = {"x": x_value}
        for key, expression in (("first", f), ("second", g)):
            try:
                point[key] = _real_float(expression.subs(X, x_value), "Function")
            except (TypeError, ValueError, OverflowError):
                point[key] = None
        plot.append(point)

    return {
        "first_curve": sp.sstr(f),
        "second_curve": sp.sstr(g),
        "bounds": [intervals[0][0], intervals[-1][1]],
        "intersections": intersections,
        "intervals": sections,
        "integral_setup": integral_setup,
        "area": total,
        "steps": steps,
        "plot": plot,
    }


def _format_number(value: float) -> str:
    return f"{value:.8g}"


def area_between_curves(
    f_expr: str | int | float | sp.Expr,
    g_expr: str | int | float | sp.Expr,
    a: float | None = None,
    b: float | None = None,
) -> float:
    """Return total geometric area between two curves over bounds or intersections."""
    return _area_solution(f_expr, g_expr, a, b)["area"]


def solve_area_between_curves(
    f_expr: str | int | float | sp.Expr,
    g_expr: str | int | float | sp.Expr,
    a: float | None = None,
    b: float | None = None,
) -> dict[str, Any]:
    """Return the step-by-step solution and plotting data for two curves."""
    return _area_solution(f_expr, g_expr, a, b)


def solve_area_under_curve(function: str | int | float | sp.Expr, a: float, b: float) -> dict[str, Any]:
    """Return a step-by-step solution for the signed area under one curve."""
    lower, upper = _validate_bounds(a, b)
    f = _expression(function, "Function")
    area = _integral(f, lower, upper)
    return {
        "curve": sp.sstr(f),
        "bounds": [lower, upper],
        "integral_setup": f"∫[{_format_number(lower)}, {_format_number(upper)}] {sp.sstr(f)} dx",
        "area": area,
        "steps": [
            f"Set up the definite integral of f(x) = {sp.sstr(f)} from x = {_format_number(lower)} to x = {_format_number(upper)}.",
            "Find an antiderivative and evaluate it at the upper and lower bounds.",
            f"Signed area = {_format_number(area)} square units.",
        ],
    }


def solve_volume_of_revolution(
    first: str | int | float | sp.Expr,
    second: str | int | float | sp.Expr,
    axis: str,
    a: float,
    b: float,
) -> dict[str, Any]:
    """Solve a bounded region's volume using disk/washer cross-sections."""
    if axis not in {"x", "y"}:
        raise ValueError("Choose the x-axis or y-axis of rotation.")
    variable = axis
    lower, upper = _validate_bounds(a, b)
    f = _expression(first, "First function", variable)
    g = _expression(second, "Second function", variable)

    split_points = {lower, upper}
    for expression in (f, g, f - g, f + g):
        split_points.update(
            root
            for root in find_intersection_points(expression, 0, lower=lower, upper=upper)
            if lower < root < upper
        )
    points = sorted(split_points)
    sections: list[dict[str, Any]] = []
    total = 0.0
    for section_lower, section_upper in zip(points, points[1:]):
        midpoint = (section_lower + section_upper) / 2
        f_mid = _real_float(f.subs(X, midpoint), "First function")
        g_mid = _real_float(g.subs(X, midpoint), "Second function")
        if f_mid * g_mid < 0:
            outer = f if abs(f_mid) >= abs(g_mid) else g
            inner = sp.Integer(0)
        elif abs(f_mid) >= abs(g_mid):
            outer, inner = f, g
        else:
            outer, inner = g, f

        integrand = sp.simplify(sp.pi * (outer**2 - inner**2))
        section_volume = _integral(integrand, section_lower, section_upper)
        if section_volume < -1e-8:
            raise ValueError("Unable to determine a nonnegative volume on this interval.")
        section_volume = max(0.0, section_volume)
        method = "disk" if inner == 0 else "washer"
        reason = (
            "The region reaches the axis of rotation here, so the inner radius is 0 and the cross-section is a disk."
            if method == "disk"
            else "The region stays away from the axis of rotation here, leaving a nonzero inner radius and a washer."
        )
        sample_count = 24
        samples = []
        for index in range(sample_count + 1):
            coordinate = section_lower + (section_upper - section_lower) * index / sample_count
            samples.append(
                {
                    "coordinate": coordinate,
                    "outer_radius": abs(_real_float(outer.subs(X, coordinate), "Outer radius")),
                    "inner_radius": abs(_real_float(inner.subs(X, coordinate), "Inner radius")),
                }
            )
        sections.append(
            {
                "lower": section_lower,
                "upper": section_upper,
                "outer_radius": sp.sstr(outer),
                "inner_radius": sp.sstr(inner),
                "method": method,
                "reason": reason,
                "integrand": sp.sstr(integrand),
                "volume": section_volume,
                "samples": samples,
            }
        )
        total += section_volume

    integral_setup = " + ".join(
        f"∫[{_format_number(section['lower'])}, {_format_number(section['upper'])}] "
        f"{section['integrand']} d{variable}"
        for section in sections
    )
    representative_section = max(sections, key=lambda section: section["upper"] - section["lower"])
    representative_slice = representative_section["samples"][len(representative_section["samples"]) // 2]
    steps = [
        f"The bounded region is between {sp.sstr(f)} and {sp.sstr(g)} for {variable} ∈ [{_format_number(lower)}, {_format_number(upper)}].",
        f"Rotate about the {axis}-axis. Slices perpendicular to the axis use the disk/washer formula π(R² − r²) d{variable}.",
        *[
            f"On [{_format_number(section['lower'])}, {_format_number(section['upper'])}], "
            f"R = |{section['outer_radius']}| and r = |{section['inner_radius']}|: {section['reason']}"
            for section in sections
        ],
        f"Set up the volume integral: π({integral_setup}).",
        f"Evaluate and add the cross-sections: {_format_number(total)} cubic units.",
    ]
    return {
        "axis": axis,
        "variable": variable,
        "first_curve": sp.sstr(f),
        "second_curve": sp.sstr(g),
        "bounds": [lower, upper],
        "sections": sections,
        "integral_setup": integral_setup,
        "volume": total,
        "steps": steps,
        "representative_slice": {
            **representative_slice,
            "method": representative_section["method"],
            "reason": representative_section["reason"],
        },
    }
