from decimal import Decimal

from app.scrapers.vtex_offers import extract_regional_offers


def sample_product(price: int = 1500) -> dict:
    return {
        "productId": "101",
        "productName": "Leche de prueba",
        "items": [
            {
                "itemId": "SKU-101",
                "sellers": [
                    {
                        "sellerId": "1",
                        "sellerName": "Vendedor principal",
                        "commertialOffer": {
                            "Price": price,
                            "ListPrice": 1800,
                        },
                    },
                    {
                        "sellerId": "99",
                        "sellerName": "Vendedor externo",
                        "commertialOffer": {
                            "Price": 1400,
                            "ListPrice": 1500,
                        },
                    },
                ],
            }
        ],
    }


def test_extracts_price_per_seller() -> None:
    offers, truncated = extract_regional_offers([sample_product()])

    assert len(offers) == 2
    assert truncated is False

    principal = next(item for item in offers if item.seller_id == "1")

    external = next(item for item in offers if item.seller_id == "99")

    assert principal.sku_id == "SKU-101"
    assert principal.current_price == Decimal("1500")
    assert principal.list_price == Decimal("1800")

    assert external.current_price == Decimal("1400")


def test_does_not_duplicate_same_sku_and_seller() -> None:
    product = sample_product()

    offers, truncated = extract_regional_offers([product, product])

    assert len(offers) == 2
    assert truncated is False


def test_missing_price_is_not_fabricated() -> None:
    product = sample_product()
    product["items"][0]["sellers"][0]["commertialOffer"]["Price"] = 0

    offers, _ = extract_regional_offers([product])

    principal = next(item for item in offers if item.seller_id == "1")

    assert principal.current_price is None


def test_limits_number_of_offers() -> None:
    offers, truncated = extract_regional_offers(
        [sample_product()],
        max_offers=1,
    )

    assert len(offers) == 1
    assert truncated is True
