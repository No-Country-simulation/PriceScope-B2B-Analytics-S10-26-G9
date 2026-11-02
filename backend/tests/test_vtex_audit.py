import json

import pytest

from app.scrapers.vtex_audit import audit_vtex_sample
from scripts.audit_vtex_sample import main


def sample_products() -> list[dict]:
    return [
        {
            "items": [
                {
                    "itemId": "SKU-101",
                    "ean": "07796962006527",
                    "sellers": [
                        {
                            "sellerId": "1",
                            "sellerName": "Tienda principal",
                            "sellerDefault": True,
                            "commertialOffer": {"Price": 1500},
                        },
                        {
                            "sellerId": "99",
                            "sellerName": "Marketplace",
                            "sellerDefault": False,
                            "commertialOffer": {"Price": 1400},
                        },
                    ],
                },
                {
                    "itemId": "SKU-102",
                    "ean": None,
                    "sellers": [
                        {
                            "sellerId": "1",
                            "sellerName": "Tienda principal",
                            "sellerDefault": False,
                            "commertialOffer": {"Price": 0},
                        }
                    ],
                },
            ]
        },
        {
            "items": [
                {
                    "itemId": "SKU-101",
                    "ean": "07796962006527",
                    "sellers": [
                        {
                            "sellerId": "1",
                            "sellerName": "Tienda principal",
                            "sellerDefault": True,
                            "commertialOffer": {"Price": 1500},
                        }
                    ],
                }
            ]
        },
    ]


def test_audit_counts_unique_skus_and_eans() -> None:
    report = audit_vtex_sample(sample_products())

    assert report.product_count == 2
    assert report.sku_count == 2
    assert report.skus_with_ean == 1
    assert report.distinct_eans == 1


def test_audit_distinguishes_sellers() -> None:
    report = audit_vtex_sample(sample_products())

    assert len(report.sellers) == 2

    principal = next(seller for seller in report.sellers if seller.seller_id == "1")

    marketplace = next(seller for seller in report.sellers if seller.seller_id == "99")

    assert principal.sku_count == 2
    assert principal.priced_sku_count == 1
    assert principal.default_sku_count == 1

    assert marketplace.sku_count == 1
    assert marketplace.priced_sku_count == 1


@pytest.mark.parametrize(
    "invalid",
    [
        None,
        {},
        {"products": []},
        ["not a product"],
    ],
)
def test_audit_rejects_invalid_payload(
    invalid: object,
) -> None:
    with pytest.raises(ValueError):
        audit_vtex_sample(invalid)


def test_audit_accepts_empty_sample() -> None:
    report = audit_vtex_sample([])

    assert report.product_count == 0
    assert report.sellers == ()


def test_cli_reads_local_json(
    tmp_path,
    capsys,
) -> None:
    path = tmp_path / "sample.json"
    path.write_text(
        json.dumps(sample_products()),
        encoding="utf-8",
    )

    result = main(
        [
            str(path),
            "--store",
            "carrefour",
        ]
    )

    output = capsys.readouterr().out

    assert result == 0
    assert "Carrefour" not in output
    assert "carrefour" in output
    assert "SKUs diferentes: 2" in output
    assert "sellerId: 1" in output
    assert "sellerId: 99" in output


def test_cli_rejects_invalid_json(
    tmp_path,
) -> None:
    path = tmp_path / "invalid.json"
    path.write_text("{invalid", encoding="utf-8")

    with pytest.raises(SystemExit) as exc:
        main([str(path), "--store", "jumbo"])

    assert exc.value.code == 2
