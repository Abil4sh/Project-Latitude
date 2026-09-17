"""Synthetic longitudinal borrower data for the Latitude prototype.

The generator intentionally creates realistic overlap between stable, temporary-shock,
and structural-decline repayment paths. The future six-month stress label is *not*
used in feature creation, preventing target leakage.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RNG_SEED = 2026


def _smooth_noise(rng: np.random.Generator, n: int, scale: float) -> np.ndarray:
    raw = rng.normal(0, scale, n)
    kernel = np.array([0.2, 0.6, 0.2])
    return np.convolve(np.pad(raw, (1, 1), mode='edge'), kernel, mode='valid')


def generate_borrower(
    borrower_id: str,
    profile_type: str,
    n_months: int,
    rng: np.random.Generator,
) -> pd.DataFrame:
    base_income = rng.uniform(14000, 100000)
    expense_ratio = rng.uniform(0.48, 0.76)
    base_expenses = base_income * expense_ratio
    dti = rng.uniform(0.08, 0.29)
    installment = base_income * rng.uniform(0.11, 0.24)
    loan_balance = base_income * rng.uniform(2.5, 5.2)

    months = np.arange(n_months)
    income = base_income * (1 + _smooth_noise(rng, n_months, 0.018))

    if profile_type == 'stable':
        # Mild drift and small seasonal variation.
        income *= (1 + rng.uniform(-0.001, 0.003) * months)
        income *= 1 + 0.025 * np.sin(months / 3.2 + rng.uniform(0, 2 * np.pi))

    elif profile_type == 'temporary_stress':
        dip_start = int(rng.integers(8, max(10, n_months - 15)))
        dip_len = int(rng.integers(3, 7))
        dip_end = min(n_months, dip_start + dip_len)
        dip_depth = rng.uniform(0.35, 0.58)
        income[dip_start:dip_end] *= (1 - dip_depth)
        recovery_end = min(n_months, dip_end + int(rng.integers(4, 9)))
        if recovery_end > dip_end:
            progress = np.linspace(0, 1, recovery_end - dip_end)
            income[dip_end:recovery_end] *= 1 - dip_depth * (1 - progress) * rng.uniform(0.65, 0.95)
        income *= 1 + 0.018 * np.sin(months / 2.6 + rng.uniform(0, 2 * np.pi))

    elif profile_type == 'structural_decline':
        decline_start = int(rng.integers(8, max(10, n_months - 13)))
        decline_rate = rng.uniform(0.012, 0.024)
        income[decline_start:] *= (1 - decline_rate) ** np.arange(n_months - decline_start)
        # A small temporary shock can exist on top of the decline.
        if rng.random() < 0.45:
            shock_start = int(rng.integers(decline_start + 2, n_months - 5))
            shock_len = int(rng.integers(2, 5))
            income[shock_start:shock_start + shock_len] *= rng.uniform(0.78, 0.9)

    else:
        raise ValueError(profile_type)

    income = np.clip(income, base_income * 0.18, None)
    expenses = base_expenses * (1 + _smooth_noise(rng, n_months, 0.035))
    expenses *= 1 + 0.015 * np.sin(months / 4.8 + rng.uniform(0, 2 * np.pi))
    expenses = np.clip(expenses, base_income * 0.25, None)

    # A borrower can still pay despite a noisy month when surplus clears the installment.
    payment_capacity = income - expenses
    repaid_on_time = (payment_capacity >= installment).astype(int)

    return pd.DataFrame({
        'borrower_id': borrower_id,
        'profile_type': profile_type,
        'month': months,
        'income': np.round(income),
        'expenses': np.round(expenses),
        'loan_installment': np.round(installment),
        'dti': round(float(dti), 3),
        'loan_balance': np.round(loan_balance),
        'repaid_on_time': repaid_on_time,
    })


def generate_dataset(
    n_stable: int = 140,
    n_temp_stress: int = 140,
    n_structural_decline: int = 140,
    seed: int = RNG_SEED,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    profiles = (
        ['stable'] * n_stable
        + ['temporary_stress'] * n_temp_stress
        + ['structural_decline'] * n_structural_decline
    )
    rng.shuffle(profiles)

    all_borrowers = []
    for i, profile in enumerate(profiles, start=1):
        n_months = int(rng.integers(30, 43))
        all_borrowers.append(
            generate_borrower(f'B{i:04d}', profile, n_months, rng)
        )
    return pd.concat(all_borrowers, ignore_index=True)


if __name__ == '__main__':
    df = generate_dataset()
    print(df.groupby('profile_type')['borrower_id'].nunique())
    print('rows:', len(df))
