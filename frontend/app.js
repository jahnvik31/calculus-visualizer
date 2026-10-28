const form = document.querySelector("#solver-form");
const graph = document.querySelector("#graph");
const doubleGraphs = document.querySelector("#double-graphs");
const dyGraph = document.querySelector("#dy-graph");
const dxGraph = document.querySelector("#dx-graph");
const stepsList = document.querySelector("#steps-list");
const errorMessage = document.querySelector("#error-message");
const areaValue = document.querySelector("#area-value");
const intervalSummary = document.querySelector("#interval-summary");
const stepCounter = document.querySelector("#step-counter");
const previousButton = document.querySelector("#previous-step");
const nextButton = document.querySelector("#next-step");
const themeToggle = document.querySelector("#theme-toggle");
const areaModeButton = document.querySelector("#area-mode");
const volumeModeButton = document.querySelector("#volume-mode");
const doubleIntegralModeButton = document.querySelector("#double-integral-mode");
const rotationAxis = document.querySelector("#rotation-axis");
const firstFunctionLabel = document.querySelector("#first-function-label");
const secondFunctionLabel = document.querySelector("#second-function-label");
const SVG_NS = "http://www.w3.org/2000/svg";
let solution = null;
let activeStep = -1;
let mode = "area";
let latestRequest = 0;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function updateThemeToggle() {
  const isDark = document.documentElement.dataset.theme === "dark"
    || (!document.documentElement.dataset.theme && systemTheme.matches);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.textContent = `${isDark ? "Light" : "Dark"} mode`;
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#151c1a" : "#f7f8f5";
}

systemTheme.addEventListener("change", (event) => {
  if (document.documentElement.dataset.themeMode !== "system") return;
  document.documentElement.dataset.theme = event.matches ? "dark" : "light";
  updateThemeToggle();
});

themeToggle.addEventListener("click", () => {
  const isDark = themeToggle.getAttribute("aria-pressed") === "true";
  document.documentElement.dataset.theme = isDark ? "light" : "dark";
  document.documentElement.dataset.themeMode = "user";
  localStorage.setItem("calculus-visualizer-theme", isDark ? "light" : "dark");
  updateThemeToggle();
});

updateThemeToggle();

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
}

function clearGraph() {
  graph.replaceChildren();
  graph.append(svgElement("text", { x: 450, y: 220, "text-anchor": "middle", class: "tick-label" }, "Your graph will appear here"));
}

function numberLabel(value) {
  if (Math.abs(value) < 1e-9) return "0";
  return Number(value.toPrecision(3)).toString();
}

function drawGraph(data, selectedStep) {
  graph.replaceChildren();
  const width = 900;
  const height = 430;
  const margin = { left: 62, right: 23, top: 39, bottom: 43 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const [xMin, xMax] = data.bounds;
  const validY = data.plot.flatMap((point) => [point.first, point.second]).filter(Number.isFinite);
  let yMin = Math.min(0, ...validY);
  let yMax = Math.max(0, ...validY);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPadding = (yMax - yMin) * 0.12 || 1;
  yMin -= yPadding;
  yMax += yPadding;
  const x = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const y = (value) => margin.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  for (let index = 0; index <= 5; index += 1) {
    const xValue = xMin + ((xMax - xMin) * index) / 5;
    const yValue = yMin + ((yMax - yMin) * index) / 5;
    graph.append(svgElement("line", { x1: x(xValue), y1: margin.top, x2: x(xValue), y2: height - margin.bottom, class: "grid-line" }));
    graph.append(svgElement("text", { x: x(xValue), y: height - 17, "text-anchor": "middle", class: "tick-label" }, numberLabel(xValue)));
    graph.append(svgElement("line", { x1: margin.left, y1: y(yValue), x2: width - margin.right, y2: y(yValue), class: "grid-line" }));
    graph.append(svgElement("text", { x: margin.left - 10, y: y(yValue) + 3, "text-anchor": "end", class: "tick-label" }, numberLabel(yValue)));
  }

  const axisY = yMin <= 0 && yMax >= 0 ? y(0) : height - margin.bottom;
  const axisX = xMin <= 0 && xMax >= 0 ? x(0) : margin.left;
  graph.append(svgElement("line", { x1: margin.left, y1: axisY, x2: width - margin.right, y2: axisY, class: "axis-line" }));
  graph.append(svgElement("line", { x1: axisX, y1: margin.top, x2: axisX, y2: height - margin.bottom, class: "axis-line" }));
  graph.append(svgElement("text", { x: width - margin.right - 2, y: axisY - 8, "text-anchor": "end", class: "tick-label" }, "x"));
  graph.append(svgElement("text", { x: axisX + 8, y: margin.top + 10, class: "tick-label" }, "y"));

  if (selectedStep >= 2) {
    for (const interval of data.intervals) {
      const points = data.plot.filter((point) => point.x >= interval.lower - 1e-9 && point.x <= interval.upper + 1e-9);
      const topKey = interval.top === "f(x)" ? "first" : "second";
      const bottomKey = interval.bottom === "f(x)" ? "first" : "second";
      const topPoints = points.filter((point) => Number.isFinite(point[topKey]));
      const bottomPoints = points.filter((point) => Number.isFinite(point[bottomKey]));
      if (topPoints.length < 2 || bottomPoints.length < 2) continue;
      const path = [
        ...topPoints.map((point, index) => `${index ? "L" : "M"}${x(point.x)},${y(point[topKey])}`),
        ...bottomPoints.slice().reverse().map((point) => `L${x(point.x)},${y(point[bottomKey])}`),
        "Z",
      ].join(" ");
      graph.append(svgElement("path", { d: path, class: "area-shape" }));
    }
  }

  if (selectedStep >= 1) {
    for (const bound of data.bounds) {
      graph.append(svgElement("line", { x1: x(bound), y1: margin.top, x2: x(bound), y2: height - margin.bottom, class: "bound-line" }));
    }
  }

  for (const key of ["first", "second"]) {
    let path = "";
    let penDown = false;
    for (const point of data.plot) {
      const value = point[key];
      if (!Number.isFinite(value)) { penDown = false; continue; }
      path += `${penDown ? "L" : "M"}${x(point.x)},${y(value)} `;
      penDown = true;
    }
    graph.append(svgElement("path", { d: path, class: key === "first" ? "plot-line-first" : "plot-line-second" }));
  }

  if (selectedStep >= 0) {
    for (const intersection of data.intersections) {
      if (intersection < xMin || intersection > xMax) continue;
      const point = data.plot.find((sample) => Math.abs(sample.x - intersection) < 1e-8);
      if (!point || !Number.isFinite(point.first)) continue;
      graph.append(svgElement("circle", { cx: x(intersection), cy: y(point.first), r: 5, class: "intersection-dot" }));
    }
  }
}

function drawSolid(data, selectedStep) {
  graph.replaceChildren();
  const width = 900;
  const height = 430;
  const allSamples = data.sections.flatMap((section) => section.samples);
  const maximumRadius = Math.max(1, ...allSamples.map((sample) => sample.outer_radius));
  const [minimum, maximum] = data.bounds;
  const midpoint = (minimum + maximum) / 2;
  const axialScale = (data.axis === "x" ? 550 : 245) / (maximum - minimum);
  const radialScale = 135 / maximumRadius;
  const project = (coordinate, radius, angle) => {
    const radial = radius * radialScale;
    const axial = (coordinate - midpoint) * axialScale;
    const cosine = radial * Math.cos(angle);
    const sine = radial * Math.sin(angle);
    return data.axis === "x"
      ? [450 + axial + sine * 0.42, 215 - cosine - sine * 0.2]
      : [450 + cosine + sine * 0.35, 215 - axial - sine * 0.2];
  };
  const pointList = (sample, radius, reverse = false) => {
    const angles = Array.from({ length: 32 }, (_, index) => (index / 32) * Math.PI * 2);
    if (reverse) angles.reverse();
    return angles.map((angle) => project(sample.coordinate, radius, angle));
  };
  const pathFromPoints = (points, close = false) =>
    `${points.map(([px, py], index) => `${index ? "L" : "M"}${px},${py}`).join(" ")}${close ? " Z" : ""}`;

  graph.append(svgElement("line", {
    x1: project(minimum, 0, 0)[0], y1: project(minimum, 0, 0)[1],
    x2: project(maximum, 0, 0)[0], y2: project(maximum, 0, 0)[1], class: "solid-axis",
  }));
  for (const section of data.sections) {
    const samples = section.samples;
    const angleCount = 24;
    for (let index = 0; index < samples.length - 1; index += 1) {
      for (let angleIndex = 0; angleIndex < angleCount; angleIndex += 1) {
        const angle = (angleIndex / angleCount) * Math.PI * 2;
        const nextAngle = ((angleIndex + 1) / angleCount) * Math.PI * 2;
        const outerPoints = [
          project(samples[index].coordinate, samples[index].outer_radius, angle),
          project(samples[index + 1].coordinate, samples[index + 1].outer_radius, angle),
          project(samples[index + 1].coordinate, samples[index + 1].outer_radius, nextAngle),
          project(samples[index].coordinate, samples[index].outer_radius, nextAngle),
        ];
        graph.append(svgElement("path", { d: pathFromPoints(outerPoints, true), class: "solid-face" }));
        if (section.method === "washer") {
          const innerPoints = [
            project(samples[index].coordinate, samples[index].inner_radius, angle),
            project(samples[index + 1].coordinate, samples[index + 1].inner_radius, angle),
            project(samples[index + 1].coordinate, samples[index + 1].inner_radius, nextAngle),
            project(samples[index].coordinate, samples[index].inner_radius, nextAngle),
          ];
          graph.append(svgElement("path", { d: pathFromPoints(innerPoints, true), class: "solid-inner-face" }));
        }
      }
    }
    for (let index = 0; index < samples.length; index += 4) {
      graph.append(svgElement("path", {
        d: pathFromPoints(pointList(samples[index], samples[index].outer_radius), true),
        class: "solid-ring",
      }));
    }
    for (let angleIndex = 0; angleIndex < 12; angleIndex += 1) {
      const angle = (angleIndex / 12) * Math.PI * 2;
      const outerLine = samples.map((sample) => project(sample.coordinate, sample.outer_radius, angle));
      graph.append(svgElement("path", { d: pathFromPoints(outerLine), class: "solid-ring" }));
    }
  }

  if (selectedStep >= 2) {
    const slice = data.representative_slice;
    const outer = pointList(slice, slice.outer_radius);
    const inner = slice.inner_radius > 1e-9 ? pointList(slice, slice.inner_radius, true) : [];
    graph.append(svgElement("path", {
      d: `${pathFromPoints(outer, true)} ${inner.length ? pathFromPoints(inner, true) : ""}`,
      class: "solid-slice",
      "fill-rule": "evenodd",
    }));
    const labelPosition = project(slice.coordinate, slice.outer_radius, Math.PI / 2);
    graph.append(svgElement("text", {
      x: labelPosition[0] + 10, y: labelPosition[1] - 8, class: "solid-label",
    }, `${slice.method} slice`));
  }
  graph.append(svgElement("text", { x: 450, y: 405, "text-anchor": "middle", class: "solid-label" },
    `Rotation about the ${data.axis}-axis · highlighted ${data.representative_slice.method}`));
}

function drawDoubleGraphs(data) {
  const drawRegion = (target, strip, horizontal) => {
    target.replaceChildren();
    const width = 430;
    const height = 330;
    const margin = { left: 43, right: 16, top: 20, bottom: 35 };
    const [xMin, xMax] = data.bounds;
    const [yMin, yMax] = data.y_bounds;
    const x = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * (width - margin.left - margin.right);
    const y = (value) => height - margin.bottom - ((value - yMin) / (yMax - yMin)) * (height - margin.top - margin.bottom);
    const region = [
      ...data.plot.map((point) => `${x(point.x)},${y(point.upper)}`),
      ...data.plot.slice().reverse().map((point) => `${x(point.x)},${y(point.lower)}`),
    ];
    target.append(svgElement("path", { d: `M${region.join(" L")} Z`, class: "double-region" }));
    target.append(svgElement("line", {
      x1: x(data.bounds[0]), y1: y(data.plot[0].lower),
      x2: x(data.bounds[1]), y2: y(data.plot[data.plot.length - 1].lower), class: "plot-line-first",
    }));
    target.append(svgElement("line", {
      x1: x(data.bounds[0]), y1: y(data.plot[0].upper),
      x2: x(data.bounds[1]), y2: y(data.plot[data.plot.length - 1].upper), class: "plot-line-second",
    }));
    target.append(svgElement("line", {
      x1: x(xMin), y1: y(yMin), x2: x(xMin), y2: y(yMax), class: "axis-line",
    }));
    target.append(svgElement("line", {
      x1: x(xMin), y1: y(yMin), x2: x(xMax), y2: y(yMin), class: "axis-line",
    }));
    if (horizontal) {
      target.append(svgElement("line", {
        x1: x(strip.left), y1: y(strip.y), x2: x(strip.right), y2: y(strip.y),
        class: "double-strip horizontal",
      }));
    } else {
      target.append(svgElement("line", {
        x1: x(strip.x), y1: y(strip.lower), x2: x(strip.x), y2: y(strip.upper),
        class: "double-strip",
      }));
    }
    target.append(svgElement("text", {
      x: width / 2, y: height - 7, "text-anchor": "middle", class: "tick-label",
    }, "x"));
    target.append(svgElement("text", {
      x: 13, y: height / 2, "text-anchor": "middle", class: "tick-label",
    }, "y"));
  };
  drawRegion(dyGraph, data.x_strip, false);
  drawRegion(dxGraph, data.y_strip, true);
}

function showStep(index) {
  if (!solution) return;
  activeStep = Math.max(0, Math.min(index, solution.steps.length - 1));
  [...stepsList.children].forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === activeStep));
  stepCounter.textContent = `${activeStep + 1} / ${solution.steps.length}`;
  previousButton.disabled = activeStep === 0;
  nextButton.disabled = activeStep === solution.steps.length - 1;
  if (mode === "double") drawDoubleGraphs(solution);
  else if (mode === "volume") drawSolid(solution, activeStep);
  else drawGraph(solution, activeStep);
}

function displaySolution(data) {
  solution = data;
  stepsList.replaceChildren();
  data.steps.forEach((step, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "step-item";
    item.append(
      Object.assign(document.createElement("span"), { className: "step-number", textContent: String(index + 1) }),
      Object.assign(document.createElement("span"), { textContent: step }),
    );
    item.addEventListener("click", () => showStep(index));
    stepsList.append(item);
  });
  const isVolume = mode === "volume";
  const isDouble = mode === "double";
  const resultValue = isVolume ? data.volume : isDouble ? data.dy_first_value : data.area;
  areaValue.replaceChildren(document.createTextNode(Number(resultValue.toPrecision(8)).toString()));
  const units = document.createElement("span");
  units.textContent = isVolume ? " cubic units" : isDouble ? " (both orders)" : " square units";
  areaValue.append(units);
  document.querySelector("#double-answer").hidden = !isDouble;
  if (isDouble) {
    document.querySelector("#double-answer").textContent =
      `dy first: ${Number(data.dy_first_value.toPrecision(8))} · dx first: ${Number(data.dx_first_value.toPrecision(8))}`;
  }
  intervalSummary.textContent = isDouble
    ? `x ∈ [${numberLabel(data.bounds[0])}, ${numberLabel(data.bounds[1])}] · both orders agree`
    : `${data.variable || "x"} ∈ [${numberLabel(data.bounds[0])}, ${numberLabel(data.bounds[1])}]${isVolume ? ` · ${data.axis}-axis rotation` : ""}`;
  showStep(0);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const requestId = ++latestRequest;
  errorMessage.hidden = true;
  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.firstElementChild.textContent = "Solving…";
  const isVolume = mode === "volume";
  const isDouble = mode === "double";
  const request = {
    first_function: form.elements.first_function.value,
    second_function: form.elements.second_function.value,
    lower_bound: form.elements.lower_bound.value === "" ? null : Number(form.elements.lower_bound.value),
    upper_bound: form.elements.upper_bound.value === "" ? null : Number(form.elements.upper_bound.value),
  };
  const doubleRequest = {
    integrand: document.querySelector("#integrand").value,
    lower_function: document.querySelector("#lower-function").value,
    upper_function: document.querySelector("#upper-function").value,
    lower_bound: Number(document.querySelector("#double-lower-bound").value),
    upper_bound: Number(document.querySelector("#double-upper-bound").value),
  };
  try {
    const response = await fetch(
      isDouble ? "/api/solve-double-integral" : isVolume ? "/api/solve-volume" : "/api/solve",
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isDouble ? doubleRequest : isVolume ? { ...request, axis: rotationAxis.value } : request),
      },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "The problem could not be solved.");
    if (requestId === latestRequest) displaySolution(result);
  } catch (error) {
    if (requestId === latestRequest) {
      errorMessage.textContent = error instanceof Error ? error.message : "The problem could not be solved.";
      errorMessage.hidden = false;
    }
  } finally {
    if (requestId === latestRequest) {
      submitButton.disabled = false;
      submitButton.firstElementChild.textContent = mode === "volume"
        ? "Solve this volume"
        : mode === "double" ? "Solve this double integral" : "Solve this area";
    }
  }
});

function loadExample() {
  const axis = rotationAxis.value;
  if (mode === "double") {
    document.querySelector("#integrand").value = "x + y";
    document.querySelector("#lower-function").value = "x";
    document.querySelector("#upper-function").value = "2 - x";
    document.querySelector("#double-lower-bound").value = "0";
    document.querySelector("#double-upper-bound").value = "1";
  } else if (mode === "area") {
    form.elements.first_function.value = "x**2";
    form.elements.second_function.value = "x";
    form.elements.lower_bound.value = "0";
    form.elements.upper_bound.value = "1";
  } else if (axis === "x") {
    form.elements.first_function.value = "x";
    form.elements.second_function.value = "0";
    form.elements.lower_bound.value = "0";
    form.elements.upper_bound.value = "1";
  } else {
    form.elements.first_function.value = "2";
    form.elements.second_function.value = "1";
    form.elements.lower_bound.value = "0";
    form.elements.upper_bound.value = "3";
  }
  form.requestSubmit();
}

function updateMode(nextMode, solve = true) {
  mode = nextMode;
  const isVolume = mode === "volume";
  const isDouble = mode === "double";
  volumeModeButton.classList.toggle("active", isVolume);
  doubleIntegralModeButton.classList.toggle("active", isDouble);
  areaModeButton.classList.toggle("active", !isVolume && !isDouble);
  areaModeButton.setAttribute("aria-pressed", String(!isVolume && !isDouble));
  volumeModeButton.setAttribute("aria-pressed", String(isVolume));
  doubleIntegralModeButton.setAttribute("aria-pressed", String(isDouble));
  document.querySelector("#volume-options").hidden = !isVolume;
  document.querySelector("#single-inputs").hidden = isDouble;
  document.querySelector("#double-inputs").hidden = !isDouble;
  document.querySelector("#graph").hidden = isDouble;
  doubleGraphs.hidden = !isDouble;
  document.querySelector("#chart-legend").hidden = isDouble;
  document.querySelector("#intro-highlight").textContent = isVolume
    ? "a solid in 3D."
    : isDouble ? "a double integral." : "between two curves.";
  document.querySelector("#intro-copy").textContent = isVolume
    ? "Choose an axis and bound the region. We’ll select disks or washers, explain the radii, and build a rotatable-solid view one step at a time."
    : isDouble
      ? "Describe a region between straight-line boundaries. See vertical and horizontal strips, derive both orders, and compare their answers."
      : "Enter two functions and an interval. We’ll find where they cross, show which curve is on top, and build the integral one step at a time.";
  document.querySelector(".intro .eyebrow").innerHTML = isVolume
    ? "SINGLE VARIABLE CALCULUS <span>·</span> VOLUME"
    : isDouble ? "MULTIVARIABLE CALCULUS <span>·</span> DOUBLE INTEGRALS" : "SINGLE VARIABLE CALCULUS <span>·</span> AREA";
  document.querySelector(".input-panel .panel-heading h2").textContent = isVolume || isDouble ? "Set up the region" : "Set up the curves";
  document.querySelector("#result-title").textContent = isVolume ? "Explore the solid" : isDouble ? "Compare both orders" : "Follow the steps";
  document.querySelector("#total-label").textContent = isVolume ? "TOTAL VOLUME" : isDouble ? "INTEGRAL VALUE" : "TOTAL AREA";
  document.querySelector("#bounds-hint").textContent = isVolume ? "along the rotation axis" : "where to measure the area";
  document.querySelector("#interval-variable").textContent = isVolume
    ? `${rotationAxis.value} interval`
    : "x interval";
  document.querySelector("#syntax-hint").textContent = isVolume
    ? `Enter functions of ${rotationAxis.value}, such as ${rotationAxis.value}**2, ${rotationAxis.value}, or 0.`
    : "Try x**2, sin(x), sqrt(x), or exp(x).";
  document.querySelector(".solve-button span").textContent = isVolume
    ? "Solve this volume"
    : isDouble ? "Solve this double integral" : "Solve this area";
  firstFunctionLabel.replaceChildren(
    Object.assign(document.createElement("span"), { className: "curve-dot red" }),
    document.createTextNode(isVolume
      ? rotationAxis.value === "x" ? " y = f(x)" : " x = f(y)"
      : " f(x)"),
  );
  secondFunctionLabel.replaceChildren(
    Object.assign(document.createElement("span"), { className: "curve-dot blue" }),
    document.createTextNode(isVolume
      ? rotationAxis.value === "x" ? " y = g(x)" : " x = g(y)"
      : " g(x)"),
  );
  graph.setAttribute("aria-label", isVolume
    ? `Three-dimensional solid of revolution about the ${rotationAxis.value}-axis`
    : "Graph of both functions and the shaded area");
  document.querySelector("#chart-legend").innerHTML = isVolume
    ? '<span><i class="legend-fill"></i>solid of revolution</span><span><i class="legend-line"></i>axis</span>'
    : '<span><i class="legend-line red-line"></i>f(x)</span><span><i class="legend-line blue-line"></i>g(x)</span><span><i class="legend-fill"></i>area</span>';
  if (solve) loadExample();
}

areaModeButton.addEventListener("click", () => updateMode("area"));
volumeModeButton.addEventListener("click", () => updateMode("volume"));
doubleIntegralModeButton.addEventListener("click", () => updateMode("double"));
rotationAxis.addEventListener("change", () => updateMode("volume"));
document.querySelector("#example-button").addEventListener("click", loadExample);
previousButton.addEventListener("click", () => showStep(activeStep - 1));
nextButton.addEventListener("click", () => showStep(activeStep + 1));
updateMode("area", false);
clearGraph();
form.requestSubmit();
