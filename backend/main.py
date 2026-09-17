from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from xgboost import XGBClassifier

from decision_engine import simulate_flexibility
from features import FEATURE_COLS

BASE = Path(__file__).resolve().parent
ART = BASE / 'artifacts'

app = FastAPI(title='Latitude Vendor Command Center API', version='2.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

if not (ART / 'data.csv').exists() or not (ART / 'features.csv').exists() or not (ART / 'metrics.json').exists():
    raise RuntimeError('Artifacts missing. Run python train_model.py first.')

data = pd.read_csv(ART / 'data.csv')
features_df = pd.read_csv(ART / 'features.csv')
metrics = json.loads((ART / 'metrics.json').read_text())

if metrics.get('model_format') == 'joblib' and (ART / 'model.joblib').exists():
    import joblib
    model = joblib.load(ART / 'model.joblib')
else:
    model = XGBClassifier()
    model.load_model(ART / 'model.json')


def _decision_for_row(row: pd.Series) -> dict:
    return simulate_flexibility(row, model)


def _all_decisions() -> pd.DataFrame:
    rows = []
    for _, row in features_df.iterrows():
        d = _decision_for_row(row)
        rows.append({
            **d,
            'months_on_record': int((data[data.borrower_id == row.borrower_id]).shape[0]),
            'dti': float(row.dti),
            'profile_type': str(row.profile_type),
            'recent_income_vs_baseline': float(row.recent_income_vs_baseline),
            'recent_miss_rate': float(row.recent_miss_rate),
            'months_below_cover': int(row.months_below_cover),
            'coverage_ratio': float(row.coverage_ratio),
            'loan_to_baseline_income': float(row.loan_to_baseline_income),
        })
    return pd.DataFrame(rows)


@app.get('/api/health')
def health():
    return {'status': 'ok', 'borrowers': len(features_df), 'model': metrics['live_api_model']}


@app.get('/api/overview')
def overview():
    decisions = _all_decisions()
    total_balance = float(decisions.loan_balance.sum())
    at_risk = decisions[decisions.stress_probability_current >= 0.5]
    flex = decisions[decisions.decision == 'APPROVE_FLEXIBILITY']
    denial = decisions[decisions.decision == 'DENY_FLEXIBILITY']
    return {
        'portfolio_balance': round(total_balance),
        'borrowers': len(decisions),
        'at_risk': int(len(at_risk)),
        'flex_candidates': int(len(flex)),
        'deny_count': int(len(denial)),
        'no_action': int((decisions.decision == 'NO_ACTION_NEEDED').sum()),
        'stress_rate': float(decisions.stress_probability_current.mean()),
        'expected_recovery_now': round(float(decisions.expected_recovery_current.sum())),
        'expected_recovery_flex': round(float(decisions.expected_recovery_flex.sum())),
        'potential_uplift': round(float(np.maximum(decisions.recovery_uplift, 0).sum())),
        'model_accuracy': metrics['accuracy'],
        'model_f1': metrics['f1'],
        'model_auc': metrics['roc_auc'],
        'top_risk_borrowers': decisions.nlargest(6, 'stress_probability_current')[['borrower_id','stress_probability_current','recovery_uplift','decision','loan_balance']].to_dict(orient='records'),
    }


@app.get('/api/borrowers')
def list_borrowers():
    decisions = _all_decisions()
    return decisions.sort_values(['stress_probability_current','loan_balance'], ascending=[False, False]).to_dict(orient='records')


@app.get('/api/borrowers/{borrower_id}/history')
def borrower_history(borrower_id: str):
    subset = data[data.borrower_id == borrower_id].sort_values('month')
    if subset.empty:
        raise HTTPException(status_code=404, detail='Borrower not found')
    return subset[['month','income','expenses','loan_installment','repaid_on_time']].to_dict(orient='records')


@app.get('/api/borrowers/{borrower_id}/decision')
def borrower_decision(borrower_id: str):
    row = features_df[features_df.borrower_id == borrower_id]
    if row.empty:
        raise HTTPException(status_code=404, detail='Borrower not found')
    return _decision_for_row(row.iloc[0])


@app.get('/api/model-metrics')
def model_metrics():
    return metrics


@app.get('/api/feature-schema')
def feature_schema():
    return {'feature_count': len(FEATURE_COLS), 'features': FEATURE_COLS}


class Scenario(BaseModel):
    income: float = Field(25000, gt=0)
    expenses: float = Field(14500, gt=0)
    installment: float = Field(3500, gt=0)
    loan_balance: float = Field(85000, gt=0)
    dti: float = Field(0.17, ge=0, le=1)
    recent_miss_rate: float = Field(0.25, ge=0, le=1)
    recent_vs_prior: float = Field(0.90, gt=0, le=2)
    recovery_ratio: float = Field(0.92, gt=0, le=2)
    normalized_slope: float = Field(-0.005, ge=-1, le=1)
    volatility: float = Field(0.10, ge=0, le=2)


@app.post('/api/scenario')
def scenario(s: Scenario):
    # Map compact user controls into the full feature vector with safe defaults.
    x = {f: 0.0 for f in FEATURE_COLS}
    baseline = max(s.income / max(s.recovery_ratio, 0.25), 1)
    surplus_ratio = (s.income - s.expenses - s.installment) / baseline
    x.update({
        'normalized_slope': s.normalized_slope,
        'volatility': s.volatility,
        'recent_vs_prior': s.recent_vs_prior,
        'dip_depth': max(0, 1 - s.recovery_ratio),
        'miss_rate_history': min(1, s.recent_miss_rate * 0.9),
        'recovery_ratio': s.recovery_ratio,
        'dti': s.dti,
        'recent_surplus_ratio': surplus_ratio,
        'projected_surplus_ratio': surplus_ratio * 1.03,
        'recent_miss_rate': s.recent_miss_rate,
        'months_below_cover': s.recent_miss_rate * 6,
        'surplus_trend': s.normalized_slope,
        'income_cv_recent': s.volatility,
        'expense_pressure': s.expenses / max(s.income, 1),
        'income_floor_ratio': max(0.3, s.recovery_ratio * 0.88),
        'income_momentum': s.recent_vs_prior - 1,
        'payment_buffer_ratio': (s.income - s.expenses) / max(s.installment, 1),
        'income_acceleration': s.normalized_slope,
        'stress_streak': round(s.recent_miss_rate * 6),
        'recovery_count': 1 if s.recovery_ratio > 1 else 0,
        'worst_3m_surplus_ratio': surplus_ratio * 0.82,
        'surplus_volatility': s.volatility,
        'recent_income_vs_baseline': s.recovery_ratio,
        'expense_trend': 0.0,
        'installment_to_income': s.installment / max(s.income, 1),
        'coverage_ratio': (s.income - s.expenses) / max(s.installment, 1),
        'income_expense_ratio': s.income / max(s.expenses, 1),
        'cashflow_autocorr': 0.25,
    })
    row = pd.Series({**x, 'borrower_id': 'SCENARIO', 'loan_balance': s.loan_balance})
    return simulate_flexibility(row, model)
