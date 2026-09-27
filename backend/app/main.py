from html import escape

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="BrokerControl360 API",
    description="API stateless pour les calculs et exports du démonstrateur local.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://164.132.96.184:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class PositionInput(BaseModel):
    quantity: float = Field(ge=0)
    price: float = Field(ge=0)
    accrued_interest: float = Field(default=0, ge=0)
    asset_class: str = 'EQUITY'
    duration: float = Field(default=3, ge=0, le=100)


class ValuationInput(BaseModel):
    positions: list[PositionInput]
    cash_balance: float = Field(default=0, ge=0)


class RiskInput(ValuationInput):
    equity_shock_pct: float = Field(default=-15, ge=-100, le=100)
    bond_rate_shock_pct: float = Field(default=2, ge=-20, le=20)


class ReportInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    snapshot_date: str
    valuation: ValuationInput
    demo_warning: str = 'Rapport de démonstration — données synthétiques.'


@app.get("/health", tags=["santé"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "brokercontrol360-api"}


@app.get("/version", tags=["santé"])
def version() -> dict[str, str]:
    return {"version": app.version, "mode": "stateless-local-demo"}


@app.post('/compute/valuation', tags=['calculs'])
def compute_valuation(payload: ValuationInput) -> dict[str, float]:
    positions_value = sum(position.quantity * (position.price + position.accrued_interest) for position in payload.positions)
    return {'securities_value': positions_value, 'cash_balance': payload.cash_balance, 'nav': positions_value + payload.cash_balance}


@app.post('/compute/risk', tags=['calculs'])
def compute_risk(payload: RiskInput) -> dict[str, float | int]:
    valuation = compute_valuation(payload)
    nav = valuation['nav'] or 1
    values = [position.quantity * (position.price + position.accrued_interest) for position in payload.positions]
    hhi = sum((value / nav * 100) ** 2 for value in values)
    stress_loss = sum(
        value * (payload.equity_shock_pct / 100 if position.asset_class.upper() == 'EQUITY' else -payload.bond_rate_shock_pct / 100 * position.duration if position.asset_class.upper() == 'BOND' else -0.02)
        for position, value in zip(payload.positions, values)
    )
    return {'hhi': round(hhi, 2), 'stress_loss': round(stress_loss, 2), 'stressed_nav': round(nav + stress_loss, 2)}


@app.post('/compute/stress-test', tags=['calculs'])
def compute_stress(payload: RiskInput) -> dict[str, float]:
    result = compute_risk(payload)
    valuation = compute_valuation(payload)
    return {'base_nav': valuation['nav'], 'estimated_loss': result['stress_loss'], 'stressed_nav': result['stressed_nav']}


@app.post('/exports/portfolio-report', tags=['exports'])
def portfolio_report(payload: ReportInput) -> dict[str, str]:
    valuation = compute_valuation(payload.valuation)
    html = (
        '<!doctype html><html lang="fr"><meta charset="utf-8"><title>BrokerControl360</title>'
        '<h1>Rapport de portefeuille — démonstration</h1>'
        f'<h2>{escape(payload.title)}</h2><p>Arrêté au {escape(payload.snapshot_date)}</p>'
        f'<p>{escape(payload.demo_warning)}</p><p>Actif net : {valuation["nav"]:,.0f} FCFA</p></html>'
    )
    return {'filename': f'rapport-portefeuille-{payload.snapshot_date}.html', 'content': html}
