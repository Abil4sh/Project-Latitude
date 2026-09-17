"""Train, validate, compare and persist the Latitude stress model."""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_predict, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from data_gen import generate_dataset
from features import FEATURE_COLS, build_features

ARTIFACTS_DIR = Path(__file__).resolve().parent / 'artifacts'
RANDOM_STATE = 2026
CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)


def score_model(name, estimator, X, y):
    proba = cross_val_predict(estimator, X, y, cv=CV, method='predict_proba', n_jobs=1)[:, 1]
    pred = (proba >= 0.5).astype(int)
    cm = confusion_matrix(y, pred).tolist()
    return {
        'accuracy': float(accuracy_score(y, pred)),
        'precision': float(precision_score(y, pred, zero_division=0)),
        'recall': float(recall_score(y, pred, zero_division=0)),
        'f1': float(f1_score(y, pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y, proba)),
        'confusion_matrix': cm,
    }, proba, pred



def main():
    ARTIFACTS_DIR.mkdir(exist_ok=True)

    print('Generating longitudinal borrower data...')
    data = generate_dataset(n_stable=140, n_temp_stress=140, n_structural_decline=140)
    data.to_csv(ARTIFACTS_DIR / 'data.csv', index=False)

    print('Extracting history-only features...')
    features_df = build_features(data)
    features_df.to_csv(ARTIFACTS_DIR / 'features.csv', index=False)

    X = features_df[FEATURE_COLS]
    y = features_df['future_stress'].astype(int)

    candidates = {
        'Logistic Regression': Pipeline([('scale', StandardScaler()), ('model', LogisticRegression(C=0.7, max_iter=2000, class_weight='balanced', random_state=RANDOM_STATE))]),
        'Random Forest (tuned)': RandomForestClassifier(n_estimators=220, max_depth=9, min_samples_leaf=2, max_features='sqrt', class_weight='balanced', random_state=RANDOM_STATE, n_jobs=1),
        'Extra Trees': ExtraTreesClassifier(n_estimators=220, max_depth=12, min_samples_leaf=2, max_features='sqrt', class_weight='balanced', random_state=RANDOM_STATE, n_jobs=1),
        'Hist Gradient Boosting': HistGradientBoostingClassifier(max_iter=180, learning_rate=0.055, max_leaf_nodes=15, l2_regularization=0.45, random_state=RANDOM_STATE),
        'XGBoost (tuned)': XGBClassifier(n_estimators=220, max_depth=4, learning_rate=0.05, min_child_weight=2, subsample=0.9, colsample_bytree=0.9, reg_lambda=1.3, reg_alpha=0.05, objective='binary:logistic', eval_metric='logloss', tree_method='hist', random_state=RANDOM_STATE, n_jobs=1),
    }

    comparison, oof_proba = {}, {}
    for name, estimator in candidates.items():
        print(f'CV scoring {name}...', flush=True)
        m, p, _ = score_model(name, estimator, X, y)
        comparison[name] = m; oof_proba[name] = p

    ranking = sorted(comparison, key=lambda k: comparison[k]['f1'], reverse=True)
    ensemble_names = ranking[:3]
    ensemble_proba = np.mean([oof_proba[n] for n in ensemble_names], axis=0)
    ensemble_pred = (ensemble_proba >= 0.5).astype(int)
    comparison['Ensemble (soft vote)'] = {
        'accuracy': float(accuracy_score(y, ensemble_pred)),
        'precision': float(precision_score(y, ensemble_pred, zero_division=0)),
        'recall': float(recall_score(y, ensemble_pred, zero_division=0)),
        'f1': float(f1_score(y, ensemble_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y, ensemble_proba)),
        'confusion_matrix': confusion_matrix(y, ensemble_pred).tolist(),
    }

    best_name = max(comparison, key=lambda k: (comparison[k]['f1'], comparison[k]['roc_auc']))
    # XGBoost is the live serving model so the API artifact stays compact and portable.
    live_name = 'XGBoost (tuned)'
    live_model = candidates[live_name]
    live_model.fit(X, y)
    live_model.save_model(ARTIFACTS_DIR / 'model.json')

    if hasattr(live_model, 'feature_importances_'):
        importances = live_model.feature_importances_
    else:
        importances = np.ones(len(FEATURE_COLS))
    fi = pd.Series(importances, index=FEATURE_COLS).sort_values(ascending=False)

    metrics = {
        'selected_model': best_name,
        'live_api_model': live_name,
        'validation_method': '5-fold stratified cross-validation',
        'n_borrowers': int(len(features_df)),
        'n_rows': int(len(data)),
        'positive_rate': float(y.mean()),
        'accuracy': float(comparison[live_name]['accuracy']),
        'precision': float(comparison[live_name]['precision']),
        'recall': float(comparison[live_name]['recall']),
        'f1': float(comparison[live_name]['f1']),
        'roc_auc': float(comparison[live_name]['roc_auc']),
        'confusion_matrix': comparison[live_name]['confusion_matrix'],
        'feature_importances': {k: float(v / fi.sum()) for k, v in fi.items()} if fi.sum() > 0 else {},
        'selected_features': FEATURE_COLS,
        'model_comparison': comparison,
        'ensemble_members': ensemble_names,
        'model_format': 'xgboost_json',
        'dataset_design': '140 stable + 140 temporary-stress + 140 structural-decline; 30-42 months each; six-month forward label',
    }
    (ARTIFACTS_DIR / 'metrics.json').write_text(json.dumps(metrics, indent=2))
    print('Champion by CV:', best_name)
    print('Live model:', live_name)
    print('Accuracy:', f"{metrics['accuracy']:.1%}")
    print('F1:', f"{metrics['f1']:.1%}")
    print('ROC-AUC:', f"{metrics['roc_auc']:.1%}")
    print('Borrowers:', len(features_df))


if __name__ == '__main__':
    main()
