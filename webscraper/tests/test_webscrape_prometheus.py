import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests
from bs4 import BeautifulSoup


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPER_PATH = REPO_ROOT / "webscraper.py"


class FakeOpenAIClient:
    def __init__(self, *args, **kwargs):
        self.responses = types.SimpleNamespace(create=MagicMock())


def load_scraper_module():
    sys.modules.pop("webscraper", None)

    fake_openai = types.ModuleType("openai")
    fake_openai.OpenAI = FakeOpenAIClient

    fake_upload = types.ModuleType("uploading_to_database")
    fake_upload.upload_all = MagicMock()

    with patch.dict(
        sys.modules,
        {
            "openai": fake_openai,
            "uploading_to_database": fake_upload,
        },
    ):
        spec = importlib.util.spec_from_file_location(
            "webscraper",
            SCRAPER_PATH,
        )
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        return module


class WebscrapePrometheusTests(unittest.TestCase):
    def setUp(self):
        self.scraper = load_scraper_module()


    def test_extract_product_cards_respects_limit(self):
        # Overuje, ze sa z HTML vytiahnu iba produktove karty a dodrzi sa zadany limit.
        html = BeautifulSoup(
            """
            <div>
                <a class="product-card">A</a>
                <a class="product-card featured">B</a>
                <a class="product-card">C</a>
            </div>
            """,
            "lxml",
        )

        result = self.scraper.extract_product_cards(html, 2)

        self.assertEqual([card.get_text(strip=True) for card in result], ["A", "B"])

    def test_get_product_store_from_card_returns_store_name(self):
        # Overuje, ze z produktovej karty sa spravne precita nazov obchodu.
        card = BeautifulSoup(
            """
            <a class="product-card">
                <div class="product-store"> Tesco </div>
            </a>
            """,
            "lxml",
        ).find("a")

        result = self.scraper.get_product_store_from_card(card)

        self.assertEqual(result, "Tesco")

    def test_get_product_store_from_card_returns_none_when_missing(self):
        # Overuje, ze pri chybajucom obchode funkcia vrati None.
        card = BeautifulSoup('<a class="product-card"></a>', "lxml").find("a")

        result = self.scraper.get_product_store_from_card(card)

        self.assertIsNone(result)

    def test_fetch_page_returns_soup_on_success(self):
        # Overuje, ze fetch_page posklada spravnu URL a pri uspesnej odpovedi vrati BeautifulSoup.
        response = MagicMock()
        response.text = "<html><body><div>ok</div></body></html>"

        with patch.object(self.scraper.session, "get", return_value=response) as mock_get:
            result = self.scraper.fetch_page("jogurt", 2, "tesco")

        self.assertEqual(result.find("div").get_text(strip=True), "ok")
        mock_get.assert_called_once_with(
            "https://promotheus.sk/jogurt?productCardGrid-page=2"
            "&productCardGrid-order=null"
            "&productCardGrid-column=null"
            "&store=tesco"
            "&do=productCardGrid-showProducts",
            timeout=10,
        )
        response.raise_for_status.assert_called_once_with()

    def test_fetch_page_returns_none_on_request_error(self):
        # Overuje, ze chyba HTTP requestu nezhodi testovany kod a vrati sa None.
        with patch.object(
            self.scraper.session,
            "get",
            side_effect=requests.RequestException("boom"),
        ):
            result = self.scraper.fetch_page("jogurt", 2, "tesco")

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
