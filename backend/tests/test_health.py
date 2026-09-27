from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "brokercontrol360-api"}


def test_version_endpoint() -> None:
    response = client.get("/version")
    assert response.status_code == 200
    assert response.json() == {"version": "0.1.0", "mode": "stateless-local-demo"}


def test_vercel_frontend_origin_can_call_stateless_api() -> None:
    response = client.options('/compute/valuation', headers={
        'Origin': 'https://brokercontrol360.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == 'https://brokercontrol360.vercel.app'


def test_vercel_preview_origin_can_call_stateless_api() -> None:
    preview_origin = 'https://brokercontrol360-git-main-van-fanell-s-projects.vercel.app'
    response = client.options('/compute/valuation', headers={
        'Origin': preview_origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == preview_origin
