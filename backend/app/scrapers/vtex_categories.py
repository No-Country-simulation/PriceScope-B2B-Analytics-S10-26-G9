"""VTEX category tree discovery and normalization."""

from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from app.scrapers.vtex_client import USER_AGENT, VtexFetchError

CATEGORY_TREE_PATH = "/api/catalog_system/pub/category/tree"


@dataclass(frozen=True)
class VtexCategory:
    id: int
    name: str
    level: int
    path: str
    has_children: bool


def parse_category_tree(data: object) -> list[VtexCategory]:
    """Flatten the nested VTEX category tree."""

    if not isinstance(data, list):
        raise VtexFetchError("Invalid VTEX category tree")

    categories: list[VtexCategory] = []

    def visit(node: object, parents: tuple[str, ...]) -> None:
        if not isinstance(node, dict):
            raise VtexFetchError("Invalid VTEX category node")

        category_id = node.get("id")
        name = node.get("name")
        children = node.get("children")

        if children is None:
            children = []

        if (
            type(category_id) is not int
            or category_id <= 0
            or not isinstance(name, str)
            or not name.strip()
            or not isinstance(children, list)
        ):
            raise VtexFetchError("Invalid VTEX category node")

        current_path = (*parents, name.strip())

        categories.append(
            VtexCategory(
                id=category_id,
                name=name.strip(),
                level=len(current_path),
                path=" > ".join(current_path),
                has_children=(bool(children) or node.get("hasChildren") is True),
            )
        )

        for child in children:
            visit(child, current_path)

    for root in data:
        visit(root, ())

    return categories


async def fetch_vtex_categories(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    levels: int = 3,
) -> list[VtexCategory]:
    """Fetch the category tree from a configured VTEX store."""

    origin = urlsplit(base_url)

    if (
        origin.scheme != "https"
        or not origin.hostname
        or origin.username is not None
        or origin.password is not None
        or origin.path not in ("", "/")
        or origin.query
        or origin.fragment
    ):
        raise ValueError("base_url must be a store HTTPS origin")

    if type(levels) is not int or not 1 <= levels <= 3:
        raise ValueError("levels must be between 1 and 3")

    url = base_url.rstrip("/") + CATEGORY_TREE_PATH + f"/{levels}"

    try:
        response = await client.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=15.0,
        )
    except httpx.RequestError as exc:
        raise VtexFetchError(f"Category tree network error: {type(exc).__name__}") from exc

    if response.status_code != 200:
        raise VtexFetchError(f"Category tree HTTP status: {response.status_code}")

    try:
        data = response.json()
    except ValueError as exc:
        raise VtexFetchError("Category tree returned invalid JSON") from exc

    return parse_category_tree(data)
