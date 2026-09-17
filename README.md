# Latitude — Repayment Decision Layer

Manipal Hackathon 2026 · Microfinance Track

Cloud decision infrastructure a lender integrates over API. Latitude reads borrower cash-flow
history, forecasts repayment stress, simulates whether temporary flexibility would improve
expected recovery, and returns a gated recommendation with its reasoning. Not a consumer app —
the lender's own systems consume it; the dashboard is one view of the API output.

## What's here

    latitude_demo.html    Self-contained demo — open it in any browser, no install, no server.
                          This is the shareable/submission artefact.
    backend/              FastAPI service + the trained model
      data_gen.py           synthetic longitudinal borrower generator
      features.py           history → feature extraction (forecast window held out)
      decision_engine.py    expected-recovery maths + approve/deny gating
      train_model.py        regenerate data, compare models, retrain
      main.py               API: /api/borrowers, /{id}/history, /{id}/decision, /api/model/metrics
      artifacts/            pre-trained model + data — demo works without retraining
    frontend/             React + Vite dashboard (the deck's stated stack)

## Run the live stack

Backend:

    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Frontend (second terminal):

    cd frontend
    npm install
    npm run dev

Then open http://localhost:5173. Health check: http://localhost:8000/api/health

Do not run `train_model.py` right before a demo — it regenerates the synthetic dataset, so which
borrowers land as approve/deny will change.

## The five views

1. **Command centre** — portfolio stats, intervention queue, recovery view
2. **Case review** — full cash-flow chart, 10 borrower signals, decision rationale, risk state
3. **Scenario lab** — move the inputs, watch the decision boundary move
4. **Borrower view** — how a borrower requests support; the request arrives as an assembled case
5. **Model health** — accuracy, confusion matrix, feature importance, model comparison, limitations

## Where the numbers come from

Synthetic longitudinal data, stated as such throughout. No public dataset tracks irregular-income
borrowers month to month, so trajectories are generated; income distributions and DTI ranges are
anchored to published lending statistics rather than invented.

The classes deliberately overlap — some declining borrowers keep paying, some stressed borrowers
aren't declining. A generator producing three cleanly separable groups would report a higher
accuracy that meant nothing.

Model selection is done under cross-validation across several candidates and picked on F1, not on
a single favourable train/test split.

## Known limits (say these before a judge finds them)

- The flexibility simulation models the *effect* of easing an installment on the forecast. It does
  not generate an amortisation schedule — that's the production step beyond this prototype.
- Decision thresholds (recovery gate, relief strength) are configured, not learned. In production
  they are lender policy inputs.
- The demo HTML is static: decisions are precomputed for all borrowers. The FastAPI service is
  where they're computed live.
