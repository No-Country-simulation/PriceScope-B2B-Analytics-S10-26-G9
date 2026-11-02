from app.scrapers.vtex_sellers import summarize_vtex_sellers


def sample_product(
    sku: str = "SKU-101",
) -> dict:
    return {
        "items": [
            {
                "itemId": sku,
                "sellers": [
                    {
                        "sellerId": "1",
                        "sellerName": "Tienda principal",
                        "sellerDefault": True,
                        "commertialOffer": {
                            "Price": 1500,
                        },
                    },
                    {
                        "sellerId": "99",
                        "sellerName": "Marketplace externo",
                        "sellerDefault": False,
                        "commertialOffer": {
                            "Price": 1300,
                        },
                    },
                ],
            }
        ]
    }


def test_identifies_multiple_sellers() -> None:
    result = summarize_vtex_sellers([sample_product()])

    assert len(result) == 2

    assert result[0].seller_id == "1"
    assert result[0].seller_name == "Tienda principal"
    assert result[0].sku_count == 1
    assert result[0].priced_sku_count == 1
    assert result[0].default_sku_count == 1

    assert result[1].seller_id == "99"
    assert result[1].seller_name == "Marketplace externo"


def test_does_not_duplicate_skus() -> None:
    product = sample_product()

    result = summarize_vtex_sellers([product, product])

    assert len(result) == 2
    assert all(seller.sku_count == 1 for seller in result)


def test_products_without_sellers() -> None:
    result = summarize_vtex_sellers([{"items": [{"itemId": "SKU-1", "sellers": []}]}])

    assert result == []


def test_seller_without_price() -> None:
    product = sample_product()
    product["items"][0]["sellers"][0]["commertialOffer"]["Price"] = 0

    result = summarize_vtex_sellers([product])

    principal = next(seller for seller in result if seller.seller_id == "1")

    assert principal.sku_count == 1
    assert principal.priced_sku_count == 0
