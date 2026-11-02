import pytest

from app.services.regional_validation import (
    compare_regional_snapshots,
    parse_regional_snapshot,
)


def sample(
    region: str = "region-a",
    location: str = "zona-a",
    price: int = 1500,
    captured_at: str = "2026-10-31T12:00:00-03:00",
) -> dict:
    return {
        "store_slug": "carrefour",
        "location_code": location,
        "region_id": region,
        "sales_channel": "1",
        "captured_at": captured_at,
        "products": [
            {
                "productId": "101",
                "productName": "Leche de prueba",
                "items": [
                    {
                        "itemId": "SKU-101",
                        "sellers": [
                            {
                                "sellerId": "1",
                                "sellerName": "Vendedor prueba",
                                "commertialOffer": {"Price": price},
                            }
                        ],
                    }
                ],
            }
        ],
    }


def test_detects_price_difference() -> None:
    first = parse_regional_snapshot(sample())

    second = parse_regional_snapshot(
        sample(
            region="region-b",
            location="zona-b",
            price=1800,
            captured_at="2026-10-31T12:02:00-03:00",
        )
    )

    result = compare_regional_snapshots(first, second)

    assert result.shared_offers == 1
    assert len(result.differences) == 1
    assert result.differences[0].sku_id == "SKU-101"
    assert result.differences[0].seller_id == "1"
    assert result.differences[0].price_a == 1500
    assert result.differences[0].price_b == 1800


def test_identical_prices() -> None:
    first = parse_regional_snapshot(sample())

    second = parse_regional_snapshot(sample(region="region-b", location="zona-b"))

    result = compare_regional_snapshots(first, second)

    assert result.shared_offers == 1
    assert result.equal_prices == 1
    assert result.differences == ()


def test_rejects_same_regional_context() -> None:
    first = parse_regional_snapshot(sample())

    second = parse_regional_snapshot(sample(location="zona-b"))

    with pytest.raises(ValueError, match="mismo contexto"):
        compare_regional_snapshots(first, second)


def test_rejects_different_stores() -> None:
    first = parse_regional_snapshot(sample())

    other = sample(
        region="region-b",
        location="zona-b",
    )
    other["store_slug"] = "jumbo"

    second = parse_regional_snapshot(other)

    with pytest.raises(ValueError, match="distintas tiendas"):
        compare_regional_snapshots(first, second)


def test_rejects_distant_capture_times() -> None:
    first = parse_regional_snapshot(sample())

    second = parse_regional_snapshot(
        sample(
            region="region-b",
            location="zona-b",
            captured_at="2026-10-31T13:00:00-03:00",
        )
    )

    with pytest.raises(ValueError, match="15 minutos"):
        compare_regional_snapshots(first, second)


def test_requires_timezone() -> None:
    data = sample(captured_at="2026-10-31T12:00:00")

    with pytest.raises(ValueError, match="zona horaria"):
        parse_regional_snapshot(data)


def test_invalid_products_are_rejected() -> None:
    data = sample()
    data["products"] = {"items": []}

    with pytest.raises(ValueError, match="products"):
        parse_regional_snapshot(data)
