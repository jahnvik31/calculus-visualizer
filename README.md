# Calculus Visualizer

Step-by-step solutions to calculus problems, with color-coded equations and diagrams that update at every step.

> **Status:** 🚧 In development

## Why this exists

 I took Calculus three times. Along the way I realised students don't fail because they're not smart. They fail because nobody shows them how to *see* (or visualize) which formula applies and why. This tool is the one I wish I'd had.

## What it does

Pick a problem type, enter your functions, and get:

- A numbered, step-by-step solution
- Equations color-coded to match their curves (f(x) in red, g(x) in blue, in both the text and the graph)
- A diagram that changes with each step
- Light and dark mode

## Supported problem types

| Problem type | Syllabus module | Status |
|---|---|---|
| Area between curves | Single Variable Calculus | Planned |
| Volume of solids of revolution | Single Variable Calculus | Planned |
| Double integrals and change of order | Multivariable Integral Calculus | Planned |

## Tech stack

- **Backend:** Python, FastAPI, SymPy
- **Frontend:** React, KaTeX, Plotly.js
- **Database:** PostgreSQL (ratings and feedback)
- **DevOps:** Docker, GitHub Actions

## Getting started

Setup instructions will be added once the first version is running.

## Roadmap

- [ ] Area between curves solver
- [ ] Volume of revolution solver
- [ ] Double integral solver
- [ ] Ratings and feedback page
- [ ] Deployment

## License

MIT