"""Audit a local VTEX JSON sample without HTTP requests.

Usage:
    uv run python -m scripts.audit_vtex_sample SAMPLE.json --store carrefour
"""

import argparse
import json
from pathlib import Path

from app.scrapers.vtex_audit import audit_vtex_sample

MAX_FILE_SIZE = 25 * 1024 * 1024


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Auditar una muestra local de VTEX")

    parser.add_argument(
        "file",
        type=Path,
        help="Archivo JSON local con una lista de productos",
    )
    parser.add_argument(
        "--store",
        required=True,
        choices=("carrefour", "jumbo"),
        help="Tienda a la que corresponde la muestra",
    )

    args = parser.parse_args(argv)

    try:
        if args.file.stat().st_size > MAX_FILE_SIZE:
            raise ValueError("El archivo supera los 25 MiB")

        data = json.loads(args.file.read_text(encoding="utf-8"))
        report = audit_vtex_sample(data)

    except (OSError, UnicodeError, ValueError) as exc:
        parser.error(f"No se pudo analizar la muestra: {exc}")

    print(f"\n=== Auditoría VTEX: {args.store} ===")
    print(f"Productos recibidos: {report.product_count}")
    print(f"SKUs diferentes: {report.sku_count}")
    print(f"SKUs con EAN: {report.skus_with_ean}")
    print(f"EAN diferentes: {report.distinct_eans}")
    print(f"Vendedores encontrados: {len(report.sellers)}")

    for seller in report.sellers:
        print(f"\nVendedor: {seller.seller_name}")
        print(f"  sellerId: {seller.seller_id}")
        print(f"  SKUs: {seller.sku_count}")
        print(f"  SKUs con precio: {seller.priced_sku_count}")
        print(f"  SKUs predeterminados: {seller.default_sku_count}")

    print(
        "\nIMPORTANTE: la muestra identifica vendedores "
        "candidatos; no confirma quién es el vendedor propio "
        "ni autoriza el uso de la fuente."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
