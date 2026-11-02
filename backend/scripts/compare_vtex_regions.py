"""Compare two local regional VTEX samples without HTTP access."""

import argparse
import json
from pathlib import Path

from app.services.regional_validation import (
    compare_regional_snapshots,
    parse_regional_snapshot,
)

MAX_FILE_SIZE = 10 * 1024 * 1024


def read_snapshot(path: Path):
    if path.stat().st_size > MAX_FILE_SIZE:
        raise ValueError("El archivo supera los 10 MiB")

    data = json.loads(path.read_text(encoding="utf-8"))

    return parse_regional_snapshot(data)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Comparar dos muestras VTEX regionales")

    parser.add_argument("region_a", type=Path)
    parser.add_argument("region_b", type=Path)

    args = parser.parse_args(argv)

    try:
        first = read_snapshot(args.region_a)
        second = read_snapshot(args.region_b)

        result = compare_regional_snapshots(
            first,
            second,
        )

    except (OSError, UnicodeError, ValueError) as exc:
        parser.error(str(exc))

    print(f"\nTienda: {result.store_slug}")
    print(f"Ubicación A: {result.location_a}")
    print(f"Ubicación B: {result.location_b}")

    print(f"\nOfertas comparables: {result.shared_offers}")
    print(f"Precios iguales: {result.equal_prices}")
    print(f"Precios diferentes: {len(result.differences)}")
    print(f"Solo en A: {result.only_a}")
    print(f"Solo en B: {result.only_b}")

    for item in result.differences:
        print(
            f"\nSKU {item.sku_id}"
            f" | Vendedor {item.seller_id}"
            f" | A: ${item.price_a}"
            f" | B: ${item.price_b}"
        )

    print(
        "\nResultado exploratorio: verificar los contextos, "
        "la procedencia y los precios contra la tienda antes "
        "de considerar validadas las regiones."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
