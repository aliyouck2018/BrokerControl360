from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_valuation_includes_bond_accrued_interest_and_cash() -> None:
    response = client.post('/compute/valuation', json={
        'positions': [{'quantity': 10, 'price': 5000, 'accrued_interest': 125, 'asset_class': 'BOND'}],
        'cash_balance': 20_000,
    })
    assert response.status_code == 200
    assert response.json() == {'securities_value': 51_250, 'cash_balance': 20_000, 'nav': 71_250}


def test_risk_and_stress_are_stateless_calculations() -> None:
    response = client.post('/compute/stress-test', json={
        'positions': [{'quantity': 100, 'price': 1000, 'asset_class': 'EQUITY'}],
        'cash_balance': 10_000,
    })
    assert response.status_code == 200
    assert response.json()['estimated_loss'] == -15_000
    assert response.json()['stressed_nav'] == 95_000


def test_invalid_negative_quantity_is_rejected() -> None:
    response = client.post('/compute/valuation', json={
        'positions': [{'quantity': -1, 'price': 1000}], 'cash_balance': 0,
    })
    assert response.status_code == 422


def test_bond_stress_uses_supplied_duration() -> None:
    response = client.post('/compute/stress-test', json={
        'positions': [{'quantity': 10, 'price': 100_000, 'asset_class': 'BOND', 'duration': 5}],
        'cash_balance': 0,
    })
    assert response.status_code == 200
    assert response.json()['estimated_loss'] == -100_000


def test_html_report_escapes_untrusted_title() -> None:
    response = client.post('/exports/portfolio-report', json={
        'title': '<script>alert(1)</script>', 'snapshot_date': '2026-09-25',
        'valuation': {'positions': [], 'cash_balance': 0},
    })
    assert response.status_code == 200
    assert '<script>' not in response.json()['content']
    assert '&lt;script&gt;' in response.json()['content']
