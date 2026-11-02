import httpx
import pytest

from app.scrapers.vtex_categories import (
    fetch_vtex_categories,
    parse_category_tree,
)
from app.scrapers.vtex_client import VtexFetchError

BASE_URL = "https://tienda.example.com"


def sample_tree() -> list[dict]:
    return [
        {
            "id": 10,
            "name": "Almacen",
            "hasChildren": True,
            "children": [
                {
                    "id": 25,
                    "name": "Lacteos",
                    "hasChildren": True,
                    "children": [
                        {
                            "id": 123,
                            "name": "Leches",
                            "hasChildren": False,
                            "children": [],
                        }
                    ],
                }
            ],
        }
    ]


def test_flattens_nested_categories() -> None:
    categories = parse_category_tree(sample_tree())

    assert len(categories) == 3
    assert [category.id for category in categories] == [
        10,
        25,
        123,
    ]

    assert categories[0].level == 1
    assert categories[1].level == 2
    assert categories[2].level == 3

    assert categories[2].path == ("Almacen > Lacteos > Leches")
    assert categories[2].has_children is False


def test_preserves_truncated_category_marker() -> None:
    tree = [
        {
            "id": 50,
            "name": "Categoria",
            "hasChildren": True,
            "children": [],
        }
    ]

    categories = parse_category_tree(tree)

    assert categories[0].has_children is True


def test_empty_tree() -> None:
    assert parse_category_tree([]) == []


def test_invalid_tree_structure() -> None:
    with pytest.raises(VtexFetchError):
        parse_category_tree({"categories": []})


async def test_fetches_category_tree() -> None:
    requests = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=sample_tree())

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        categories = await fetch_vtex_categories(
            client,
            base_url=BASE_URL,
        )

    assert len(requests) == 1

    assert requests[0].url.path == ("/api/catalog_system/pub/category/tree/3")

    assert len(categories) == 3
    assert categories[-1].id == 123


@pytest.mark.parametrize("status", [403, 429, 503])
async def test_category_tree_http_errors(
    status: int,
) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status))
    ) as client:
        with pytest.raises(
            VtexFetchError,
            match=str(status),
        ):
            await fetch_vtex_categories(
                client,
                base_url=BASE_URL,
            )


async def test_category_tree_invalid_json() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                content=b"invalid-json",
            )
        )
    ) as client:
        with pytest.raises(
            VtexFetchError,
            match="invalid JSON",
        ):
            await fetch_vtex_categories(
                client,
                base_url=BASE_URL,
            )


async def test_category_tree_timeout() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout(
            "timeout",
            request=request,
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(
            VtexFetchError,
            match="ConnectTimeout",
        ):
            await fetch_vtex_categories(
                client,
                base_url=BASE_URL,
            )


async def test_invalid_category_depth() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[]))
    ) as client:
        with pytest.raises(ValueError):
            await fetch_vtex_categories(
                client,
                base_url=BASE_URL,
                levels=0,
            )
