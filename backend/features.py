"""History-only feature extraction for six-month forward stress prediction."""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_COLS = [
    'normalized_slope', 'volatility', 'recent_vs_prior', 'dip_depth',
    'miss_rate_history', 'recovery_ratio', 'dti', 'recent_surplus_ratio',
    'projected_surplus_ratio', 'recent_miss_rate', 'months_below_cover',
    'surplus_trend', 'income_cv_recent', 'expense_pressure', 'income_floor_ratio',
    'income_momentum', 'payment_buffer_ratio', 'income_acceleration',
    'stress_streak', 'recovery_count', 'worst_3m_surplus_ratio', 'surplus_volatility',
    'recent_income_vs_baseline', 'expense_trend', 'installment_to_income',
    'coverage_ratio', 'income_expense_ratio', 'cashflow_autocorr',
]


def _safe_div(a, b, eps: float = 1e-9):
    return np.asarray(a) / np.where(np.abs(np.asarray(b)) > eps, np.asarray(b), eps)


def _linear_slope(values: np.ndarray) -> float:
    if len(values) < 2:
        return 0.0
    x = np.arange(len(values), dtype=float)
    return float(np.polyfit(x, values, 1)[0])


def _longest_zero_streak(values: np.ndarray) -> int:
    best = run = 0
    for v in values:
        if v == 0:
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def extract_features(borrower_df: pd.DataFrame, future_months: int = 6) -> pd.Series | None:
    df = borrower_df.sort_values('month').reset_index(drop=True)
    n = len(df)
    if n <= future_months + 12:
        return None

    history = df.iloc[:-future_months].copy()
    future = df.iloc[-future_months:].copy()

    income = history['income'].to_numpy(dtype=float)
    expense = history['expenses'].to_numpy(dtype=float)
    installment = float(history['loan_installment'].iloc[0])
    baseline = float(income[:6].mean())
    recent_income = float(income[-6:].mean())
    prior_income = float(income[-12:-6].mean())
    recent3 = income[-3:]
    surplus = income - expense - installment
    recent_surplus = surplus[-6:]
    prior_surplus = surplus[-12:-6]

    income_slope = _linear_slope(income)
    recent_slope = _linear_slope(income[-6:])
    prior_slope = _linear_slope(income[-12:-6])
    slope_delta = recent_slope - prior_slope

    coverage = _safe_div(income - expense, installment)
    payment_buffer_ratio = _safe_div(float((income - expense).mean()), installment)
    cashflow_autocorr = 0.0
    if len(surplus) > 2 and np.std(surplus[:-1]) > 1e-9 and np.std(surplus[1:]) > 1e-9:
        cashflow_autocorr = float(np.corrcoef(surplus[:-1], surplus[1:])[0, 1])

    future_miss_rate = 1 - future['repaid_on_time'].mean()
    future_stress = int(future_miss_rate >= 0.34)

    return pd.Series({
        'borrower_id': str(df['borrower_id'].iloc[0]),
        'profile_type': str(df['profile_type'].iloc[0]),
        'normalized_slope': _safe_div(income_slope, baseline),
        'volatility': _safe_div(np.std(income), np.mean(income)),
        'recent_vs_prior': _safe_div(recent_income, prior_income),
        'dip_depth': max(0.0, 1 - _safe_div(np.min(income), baseline)),
        'miss_rate_history': float(1 - history['repaid_on_time'].mean()),
        'recovery_ratio': _safe_div(float(recent3.mean()), baseline),
        'dti': float(history['dti'].iloc[0]),
        'recent_surplus_ratio': _safe_div(float(recent_surplus.mean()), baseline),
        'projected_surplus_ratio': _safe_div(float(recent_surplus.mean() + 2 * recent_slope), baseline),
        'recent_miss_rate': float(1 - history['repaid_on_time'].tail(6).mean()),
        'months_below_cover': int(np.sum(coverage < 1.0)),
        'surplus_trend': _safe_div(_linear_slope(surplus), baseline),
        'income_cv_recent': _safe_div(np.std(income[-6:]), np.mean(income[-6:])),
        'expense_pressure': _safe_div(float(expense[-6:].mean()), recent_income),
        'income_floor_ratio': _safe_div(float(np.percentile(income, 10)), baseline),
        'income_momentum': _safe_div(recent_slope, max(abs(prior_slope), baseline * 0.001)),
        'payment_buffer_ratio': payment_buffer_ratio,
        'income_acceleration': _safe_div(slope_delta, baseline),
        'stress_streak': _longest_zero_streak(history['repaid_on_time'].to_numpy()),
        'recovery_count': int(np.sum((income[1:] > income[:-1] * 1.10).astype(int))),
        'worst_3m_surplus_ratio': _safe_div(float(pd.Series(surplus).rolling(3).mean().min()), baseline),
        'surplus_volatility': _safe_div(np.std(surplus), max(abs(np.mean(surplus)), baseline * 0.02)),
        'recent_income_vs_baseline': _safe_div(recent_income, baseline),
        'expense_trend': _safe_div(_linear_slope(expense), baseline),
        'installment_to_income': _safe_div(installment, recent_income),
        'coverage_ratio': float(np.mean(coverage)),
        'income_expense_ratio': _safe_div(float(income.mean()), float(expense.mean())),
        'cashflow_autocorr': cashflow_autocorr,
        'loan_balance': float(history['loan_balance'].iloc[0]),
        'loan_to_baseline_income': _safe_div(float(history['loan_balance'].iloc[0]), baseline),
        'future_stress': future_stress,
    })


def build_features(data: pd.DataFrame, future_months: int = 6) -> pd.DataFrame:
    rows = []
    for borrower_id, group in data.groupby('borrower_id', sort=True):
        feat = extract_features(group, future_months=future_months)
        if feat is not None:
            rows.append(feat)
    return pd.DataFrame(rows).dropna()
