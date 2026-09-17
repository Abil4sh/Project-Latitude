from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from features import FEATURE_COLS

RECOVERY_IF_DEFAULT_PCT = 0.33
LENDER_THRESHOLD = 0.52
STABLE_STRESS_PROB_CUTOFF = 0.22


def compute_expected_recovery(loan_balance: float, completion_prob: float, recovery_if_default_pct: float = RECOVERY_IF_DEFAULT_PCT) -> float:
    return completion_prob * loan_balance + (1 - completion_prob) * loan_balance * recovery_if_default_pct


def _pct(v: float) -> str:
    return f'{v:.0%}'


def simulate_flexibility(row: pd.Series, model, lender_threshold: float = LENDER_THRESHOLD, flex_strength: float = 1.12) -> dict[str, Any]:
    X = row[FEATURE_COLS].to_frame().T.astype(float)
    loan_balance = float(row['loan_balance'])

    stress_current = float(model.predict_proba(X)[0][1])
    completion_current = 1 - stress_current
    recovery_current = compute_expected_recovery(loan_balance, completion_current)

    # Simulated 30% installment relief represented through targeted cash-flow feature perturbations.
    X_flex = X.copy()
    X_flex['recent_surplus_ratio'] *= flex_strength
    X_flex['projected_surplus_ratio'] *= flex_strength
    X_flex['recent_miss_rate'] *= 0.35
    X_flex['miss_rate_history'] *= 0.55
    X_flex['payment_buffer_ratio'] *= flex_strength
    X_flex['installment_to_income'] /= flex_strength
    X_flex['coverage_ratio'] *= flex_strength

    stress_flex = float(model.predict_proba(X_flex)[0][1])
    completion_flex = 1 - stress_flex
    recovery_flex = compute_expected_recovery(loan_balance, completion_flex)
    uplift = recovery_flex - recovery_current

    recovery_ratio = float(row['recovery_ratio'])
    recent_vs_prior = float(row['recent_vs_prior'])
    is_temporary = recovery_ratio >= 0.84 and recent_vs_prior >= 0.84
    stability_improves = completion_flex > completion_current
    recovery_above_threshold = recovery_flex / loan_balance >= lender_threshold

    if stress_current <= STABLE_STRESS_PROB_CUTOFF:
        decision = 'NO_ACTION_NEEDED'
        diagnosis = 'stable'
        why = f"Portfolio behavior is currently stable: stress probability is {_pct(stress_current)}. No intervention is triggered."
    elif is_temporary and stability_improves and recovery_above_threshold:
        decision = 'APPROVE_FLEXIBILITY'
        diagnosis = 'temporary_seasonal'
        why = f"Likely temporary cash-flow shock: recent income is {_pct(recovery_ratio)} of baseline and recovery improves under relief. Expected recovery increases by ₹{uplift:,.0f}."
    else:
        decision = 'DENY_FLEXIBILITY'
        diagnosis = 'structural_or_insufficient_uplift'
        reason = 'persistent deterioration' if not is_temporary else 'insufficient recovery uplift'
        why = f"Do not alter the schedule: {reason}. Current stress is {_pct(stress_current)}, and the flexibility scenario does not clear the portfolio rule safely."

    return {
        'borrower_id': str(row['borrower_id']),
        'diagnosis': diagnosis,
        'loan_balance': round(loan_balance, 0),
        'stress_probability_current': round(stress_current, 4),
        'stress_probability_flex': round(stress_flex, 4),
        'completion_prob_current': round(completion_current, 4),
        'completion_prob_flex': round(completion_flex, 4),
        'expected_recovery_current': round(recovery_current, 0),
        'expected_recovery_flex': round(recovery_flex, 0),
        'recovery_uplift': round(uplift, 0),
        'recovery_rate_current': round(recovery_current / loan_balance, 4),
        'recovery_rate_flex': round(recovery_flex / loan_balance, 4),
        'decision': decision,
        'recovery_ratio': round(recovery_ratio, 4),
        'recent_vs_prior': round(recent_vs_prior, 4),
        'lender_threshold': lender_threshold,
        'flex_strength': flex_strength,
        'why': why,
    }
