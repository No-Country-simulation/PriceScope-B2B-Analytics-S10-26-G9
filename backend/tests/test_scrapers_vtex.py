
import uuid
from decimal import Decimal

from app.scrapers.vtex import parse_vtex_product

STORE_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
BASE_URL = "https://tienda.example.com"


def sample_product() -> dict:
    """A fictional VTEX product for automated tests."""
    return {
        "productName": "Leche Entera 1 Litro",
        "link": "/leche-entera/p",
        "categories": ["/Almacen/Lacteos/"],
        "items": [
            {
                "itemId": "SKU-101",
                "ean": "7791234567890",
                "measurementUnit": "un",
                "sellers": [
                    {
                        "sellerId": "99",
                        "sellerName": "Marketplace externo",
                        "commertialOffer": {
                            "Price": 1100,
                            "ListPrice": 1400,
                            "AvailableQuantity": 10,
                        },
                    },
                    {
                        "sellerId": "1",
                        "sellerName": "Tienda propia",
                        "commertialOffer": {
                            "Price": 1500,
                            "ListPrice": 1800,
                            "AvailableQuantity": 15,
                        },
                    },
                ],
            }
        ],
    }


def parse(product: dict) -> list:
    return parse_vtex_product(
        product,
        store_id=STORE_ID,
        base_url=BASE_URL,
        own_seller_ids={"1"},
    )


def test_extracts_product_data() -> None:
    observations = parse(sample_product())

    assert len(observations) == 1

    result = observations[0]

    assert result.store_id == STORE_ID
    assert result.external_code == "SKU-101"
    assert result.name == "Leche Entera 1 Litro"
    assert result.current_price == Decimal("1500")
    assert result.strikethrough_price == Decimal("1800")
    assert result.available is True
    assert result.category == "/Almacen/Lacteos/"
    assert result.url == f"{BASE_URL}/leche-entera/p"


def test_ignores_external_sellers() -> None:
    product = sample_product()

    observations = parse(product)

    assert len(observations) == 1
    assert observations[0].current_price == Decimal("1500")


def test_skips_product_without_price() -> None:
    product = sample_product()

    product["items"][0]["sellers"][1]["commertialOffer"]["Price"] = 0

    assert parse(product) == []


def test_detects_unavailable_product() -> None:
    product = sample_product()

    product["items"][0]["sellers"][1]["commertialOffer"][
        "AvailableQuantity"
    ] = 0

    observations = parse(product)

    assert len(observations) == 1
    assert observations[0].available is False


def test_skips_unrecognized_sellers() -> None:
    product = sample_product()

    observations = parse_vtex_product(
        product,
        store_id=STORE_ID,
        base_url=BASE_URL,
        own_seller_ids={"999"},
    )

    assert observations == []


def test_rejects_invalid_price() -> None:
    product = sample_product()

    product["items"][0]["sellers"][1]["commertialOffer"]["Price"] = "NaN"

    assert parse(product) == []


def test_rejects_external_product_link() -> None:
    product = sample_product()
    product["link"] = "https://otra-tienda.example.com/producto"

    assert parse(product) == []


def test_extracts_multiple_skus() -> None:
    product = sample_product()
    another_item = {
        **product["items"][0],
        "itemId": "SKU-102",
    }
    product["items"].append(another_item)

    observations = parse(product)

    assert {item.external_code for item in observations} == {
        "SKU-101",
        "SKU-102",
    }
