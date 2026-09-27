#!/usr/bin/env python3
"""Generate a reproducible, clearly labelled BVMAC 2026 demonstration history."""

from __future__ import annotations

import argparse
import json
import random
from datetime import date, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def parse_date(value: str) -> date:
    return date.fromisoformat(value) if '-' in value else date.fromisoformat('-'.join(reversed(value.split('/'))))


def records_from_bulletin(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    bulletin = json.loads(path.read_text(encoding='utf-8'))
    session_date = parse_date(bulletin['metadata']['date'])
    quotes: list[dict[str, Any]] = []
    for equity in bulletin.get('marche_des_actions', []):
        quotes.append({
            'isin': equity['code_isin'], 'mnemonic': equity.get('mnemo'), 'assetClass': 'EQUITY',
            'price': equity.get('cours_du_jour_cloture', equity.get('cours_precedent')),
            'yearlyHigh': equity.get('cours_depuis_janvier_haut'),
            'yearlyLow': equity.get('cours_depuis_janvier_bas'),
            'annualVariationPreviousYearPct': equity.get('variation_annee_precedente_pct'),
            'volume': equity.get('volume_transige', 0), 'date': session_date.isoformat(),
            'status': 'OBSERVED', 'sourceBulletin': path.name,
        })
    for section, rows in bulletin.get('marche_des_obligations', {}).items():
        for bond in rows:
            nominal = bond.get('nominal_j3', 100)
            percent = bond.get('cloture', bond.get('cours_precedent_pct', 100))
            quotes.append({
                'isin': bond['code_isin'], 'mnemonic': bond.get('mnemo'), 'assetClass': 'BOND',
                'price': nominal * percent / 100, 'pricePercent': percent, 'nominal': nominal,
                'accruedInterest': bond.get('coupon_couru_j3', 0), 'volume': bond.get('volume_transige', 0),
                'date': session_date.isoformat(), 'status': 'OBSERVED', 'sourceBulletin': path.name,
                'section': section,
            })
    index = {
        'code': bulletin['metadata']['indice']['code'], 'date': session_date.isoformat(),
        'value': bulletin['metadata']['indice']['valeur'], 'status': 'OBSERVED',
        'sourceBulletin': path.name,
    }
    return index, quotes


def weekdays(start: date, end: date):
    day = start
    while day <= end:
        if day.weekday() < 5:
            yield day
        day += timedelta(days=1)


def generate_history(seed: int = 360, start: date = date(2026, 1, 1), end: date = date(2026, 9, 25)) -> dict[str, Any]:
    rng = random.Random(seed)
    bulletin_files = sorted((ROOT / 'json').glob('BOC-*.json'))
    if not bulletin_files:
        raise FileNotFoundError('Aucun bulletin BOC-*.json n’a été trouvé dans json/.')
    observed_indices: list[dict[str, Any]] = []
    observed_quotes: list[dict[str, Any]] = []
    for path in bulletin_files:
        index, quotes = records_from_bulletin(path)
        if start <= date.fromisoformat(index['date']) <= end:
            observed_indices.append(index)
            observed_quotes.extend(quotes)
    observed_indices.sort(key=lambda item: item['date'])
    observed_quotes.sort(key=lambda item: (item['isin'], item['date']))
    if not observed_indices:
        raise ValueError('Aucune observation ne se trouve dans la plage demandée.')

    first_observed = date.fromisoformat(observed_indices[0]['date'])
    last_observed = date.fromisoformat(observed_indices[-1]['date'])
    by_date_index = {date.fromisoformat(item['date']): item for item in observed_indices}
    by_isin: dict[str, list[dict[str, Any]]] = {}
    for quote in observed_quotes:
        by_isin.setdefault(quote['isin'], []).append(quote)

    interpolated_indices: list[dict[str, Any]] = []
    for left, right in zip(observed_indices, observed_indices[1:]):
        left_date, right_date = date.fromisoformat(left['date']), date.fromisoformat(right['date'])
        gap = (right_date - left_date).days
        if gap <= 1:
            continue
        for day in weekdays(left_date + timedelta(days=1), right_date - timedelta(days=1)):
            ratio = (day - left_date).days / gap
            interpolated_indices.append({
                'code': left['code'], 'date': day.isoformat(),
                'value': round(left['value'] + (right['value'] - left['value']) * ratio, 2),
                'status': 'INTERPOLATED', 'sourceBulletin': None,
                'method': 'Interpolation linéaire entre deux séances observées', 'seed': seed,
            })

    interpolated_quotes: list[dict[str, Any]] = []
    for isin, history in by_isin.items():
        history.sort(key=lambda item: item['date'])
        for left, right in zip(history, history[1:]):
            left_date, right_date = date.fromisoformat(left['date']), date.fromisoformat(right['date'])
            gap = (right_date - left_date).days
            if gap <= 1:
                continue
            for day in weekdays(left_date + timedelta(days=1), right_date - timedelta(days=1)):
                if left['assetClass'] == 'BOND':
                    price = left['price']
                    method = 'Maintien du dernier cours — obligation peu liquide'
                else:
                    ratio = (day - left_date).days / gap
                    price = left['price'] + (right['price'] - left['price']) * ratio
                    method = 'Interpolation linéaire entre deux cours observés'
                interpolated_quotes.append({
                    'isin': isin, 'mnemonic': left['mnemonic'], 'assetClass': left['assetClass'],
                    'date': day.isoformat(), 'price': round(price, 4), 'volume': None,
                    'status': 'INTERPOLATED', 'sourceBulletin': None, 'method': method, 'seed': seed,
                })

    simulated_indices: list[dict[str, Any]] = []
    simulated_quotes: list[dict[str, Any]] = []
    if start < first_observed:
        annual_return = 0.025
        market_days = list(weekdays(start, first_observed - timedelta(days=1)))
        count = max(1, len(market_days))
        anchor = observed_indices[0]['value']
        for offset, day in enumerate(market_days):
            remaining = (count - offset) / count
            drift = (1 + annual_return) ** (-remaining / 252)
            price = anchor * drift * (1 + rng.gauss(0, 0.0018))
            simulated_indices.append({
                'code': observed_indices[0]['code'], 'date': day.isoformat(), 'value': round(price, 2),
                'status': 'SIMULATED', 'sourceBulletin': None,
                'method': 'Trajectoire illustrative ancrée sur la première séance observée', 'seed': seed,
            })
        for isin, history in by_isin.items():
            first = min(history, key=lambda item: item['date'])
            final_price = first['price']
            yearly_hint = 0.0
            yearly_high = first.get('yearlyHigh') if isinstance(first.get('yearlyHigh'), (int, float)) else final_price * 1.05
            yearly_low = first.get('yearlyLow') if isinstance(first.get('yearlyLow'), (int, float)) else final_price * 0.95
            # The published year-to-date range constrains a plausible demo path;
            # it is not treated as an observed daily series.
            target = min(max(final_price - (yearly_high - yearly_low) * 0.22, yearly_low), yearly_high)
            for day in weekdays(start, first_observed - timedelta(days=1)):
                progress = (day - start).days / max(1, (first_observed - start).days)
                if first['assetClass'] == 'BOND':
                    simulated_price = final_price
                else:
                    base = target + (final_price - target) * progress
                    simulated_price = min(max(base * (1 + rng.gauss(0, 0.002)), yearly_low), yearly_high)
                simulated_quotes.append({
                    'isin': isin, 'mnemonic': first['mnemonic'], 'assetClass': first['assetClass'],
                    'date': day.isoformat(), 'price': round(simulated_price, 4), 'volume': None,
                    'status': 'SIMULATED', 'sourceBulletin': None,
        'method': 'Génération illustrative déterministe, graine fixe et repères annuels ancrés sur septembre', 'seed': seed,
                })

    return {
        'metadata': {
            'application': 'BrokerControl360', 'title': 'Historique de démonstration BVMAC 2026',
            'seed': seed, 'dateRange': {'from': start.isoformat(), 'to': end.isoformat()},
            'generatedAt': 'reproducible',
            'warning': 'Données de démonstration uniquement — ne pas utiliser pour reporting réglementaire.',
            'sourceFiles': [path.name for path in bulletin_files],
            'observedSessions': len(observed_indices),
            'counts': {
                'observedIndex': len(observed_indices), 'interpolatedIndex': len(interpolated_indices),
                'simulatedIndex': len(simulated_indices), 'observedQuotes': len(observed_quotes),
                'interpolatedQuotes': len(interpolated_quotes), 'simulatedQuotes': len(simulated_quotes),
            },
            'rules': ['Volumes non observés laissés vides.', 'Obligations maintenues entre deux séances.', 'Jours de week-end exclus.'],
        },
        'marketIndex': sorted(observed_indices + interpolated_indices + simulated_indices, key=lambda item: item['date']),
        'quotes': sorted(observed_quotes + interpolated_quotes + simulated_quotes, key=lambda item: (item['date'], item['isin'])),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=360)
    parser.add_argument('--start', type=date.fromisoformat, default=date(2026, 1, 1))
    parser.add_argument('--end', type=date.fromisoformat, default=date(2026, 9, 25))
    parser.add_argument('--output', type=Path, default=ROOT / 'json_demo_2026')
    args = parser.parse_args()
    data = generate_history(args.seed, args.start, args.end)
    args.output.mkdir(parents=True, exist_ok=True)
    output_file = args.output / 'history.json'
    output_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Fichier créé : {output_file}")
    print(json.dumps(data['metadata']['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
