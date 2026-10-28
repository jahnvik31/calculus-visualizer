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
| Area between curves | Single Variable Calculus | Implemented |
| Volume of solids of revolution | Single Variable Calculus | Implemented |
| Double integrals and change of order | Multivariable Integral Calculus | Implemented |

## Tech stack

- **Backend:** Python, FastAPI, SymPy
- **Frontend:** HTML, CSS, JavaScript, SVG
- **Database:** PostgreSQL (ratings and feedback)
- **DevOps:** Docker, GitHub Actions

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

Open http://127.0.0.1:8000. The solver accepts `x`, numeric constants, `pi`, `e`,
`+`, `-`, `*`, `/`, `**`, and `sin`, `cos`, `tan`, `exp`, `log`, `sqrt`, and `abs`.
The double-integral solver accepts integrands in `x` and `y`; its region is
specified by straight-line lower and upper `y(x)` boundaries and an `x` interval.

## Roadmap

- [x] Area between curves solver
- [x] Volume of revolution solver
- [x] Double integral solver with change of order for straight-line regions
- [ ] Ratings and feedback page
- [ ] Deployment

## License

MIT