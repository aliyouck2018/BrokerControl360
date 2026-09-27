#!/usr/bin/env python3
"""Prepare static copies of the read-only source data for the local SPA server."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


def main() -> None:
    market_directory = PUBLIC / 'market-data'
    market_directory.mkdir(parents=True, exist_ok=True)
    source_files = sorted((ROOT / 'json').glob('BOC-*.json'))
    if len(source_files) != 19:
        raise RuntimeError(f'19 bulletins sont attendus, {len(source_files)} ont été trouvés.')
    for source in source_files:
        shutil.copy2(source, market_directory / source.name)
    history = ROOT / 'json_demo_2026' / 'history.json'
    if not history.is_file():
        raise FileNotFoundError('L’historique démo manque : lancez scripts/generate_demo_history.py.')
    shutil.copy2(history, PUBLIC / 'history.json')
    history_csv = ROOT / 'json_demo_2026' / 'history.csv'
    if not history_csv.is_file():
        raise FileNotFoundError('Le CSV démo manque : lancez scripts/generate_demo_history.py.')
    shutil.copy2(history_csv, PUBLIC / 'history.csv')
    print(f'{len(source_files)} bulletins et l’historique démo prêts pour Vite.')


if __name__ == '__main__':
    main()
