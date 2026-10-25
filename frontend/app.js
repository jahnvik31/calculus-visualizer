const form = document.querySelector("#solver-form");
const graph = document.querySelector("#graph");
const stepsList = document.querySelector("#steps-list");
const errorMessage = document.querySelector("#error-message");
const areaValue = document.querySelector("#area-value");
const intervalSummary = document.querySelector("#interval-summary");
const stepCounter = document.querySelector("#step-counter");
const previousButton = document.querySelector("#previous-step");
const nextButton = document.querySelector("#next-step");
const SVG_NS = "http://www.w3.org/2000/svg";
let solution = null;
let activeStep = -1;

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

function showStep(index) {
  if (!solution) return;
  activeStep = Math.max(0, Math.min(index, solution.steps.length - 1));
  [...stepsList.children].forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === activeStep));
  stepCounter.textContent = `${activeStep + 1} / ${solution.steps.length}`;
  previousButton.disabled = activeStep === 0;
  nextButton.disabled = activeStep === solution.steps.length - 1;
  drawGraph(solution, activeStep);
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
  areaValue.replaceChildren(document.createTextNode(Number(data.area.toPrecision(8)).toString()));
  const units = document.createElement("span");
  units.textContent = " square units";
  areaValue.append(units);
  intervalSummary.textContent = `x ∈ [${numberLabel(data.bounds[0])}, ${numberLabel(data.bounds[1])}]`;
  showStep(0);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.firstElementChild.textContent = "Solving…";
  const request = {
    first_function: form.elements.first_function.value,
    second_function: form.elements.second_function.value,
    lower_bound: form.elements.lower_bound.value === "" ? null : Number(form.elements.lower_bound.value),
    upper_bound: form.elements.upper_bound.value === "" ? null : Number(form.elements.upper_bound.value),
  };
  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "The problem could not be solved.");
    displaySolution(result);
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : "The problem could not be solved.";
    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.firstElementChild.textContent = "Solve this area";
  }
});

document.querySelector("#example-button").addEventListener("click", () => {
  form.elements.first_function.value = "x**2";
  form.elements.second_function.value = "x";
  form.elements.lower_bound.value = "0";
  form.elements.upper_bound.value = "1";
  form.requestSubmit();
});
previousButton.addEventListener("click", () => showStep(activeStep - 1));
nextButton.addEventListener("click", () => showStep(activeStep + 1));
clearGraph();
form.requestSubmit();
