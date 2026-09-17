# Project Latitude

> **Irregular income doesn't mean irregular creditworthiness.**

Project Latitude is a decision-support prototype for microfinance lenders dealing with borrowers whose income changes significantly from month to month.

Instead of treating a missed EMI as an isolated credit event, Latitude looks at the borrower's **cash-flow history and expected future trajectory** to determine whether the borrower is experiencing a temporary, recoverable dip or a sustained decline.

It then simulates repayment-flexibility options and recommends the **minimum flexibility necessary** when doing so improves borrower stability while keeping expected lender recovery above a defined floor.

<img width="1440" height="810" alt="Screenshot 2026-09-17 at 4 52 35 PM" src="https://github.com/user-attachments/assets/a03c173b-4829-45e6-b7c2-d8b5a7846657" />


<img width="1436" height="805" alt="Screenshot 2026-09-17 at 4 47 30 PM" src="https://github.com/user-attachments/assets/d7d7dbc8-6619-4f21-aa4f-87b6c97ee823" />

---

## The Problem

Microfinance borrowers often earn irregular income.

Their income may fall during seasonal periods, while their loan repayment schedule remains fixed.

This creates a difficult situation:
```text
Income ↓
   ↓
EMI remains fixed
   ↓
Borrower struggles to pay
   ↓
Lender sees repayment stress
   ↓
But is this a temporary dip or a genuine decline?

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

The classes deliberately overlap some declining borrowers keep paying, some stressed borrowers
aren't declining. A generator producing three cleanly separable groups would report a higher
accuracy that meant nothing.

Model selection is done under cross-validation across several candidates and picked on F1, not on
a single favourable train/test split.

## Known limits 
- The flexibility simulation models the *effect* of easing an installment on the forecast. It does
  not generate an amortisation schedule,that's the production step beyond this prototype.
- Decision thresholds (recovery gate, relief strength) are configured, not learned. In production
  they are lender policy inputs.
- The demo HTML is static: decisions are precomputed for all borrowers. The FastAPI service is
  where they're computed live.
