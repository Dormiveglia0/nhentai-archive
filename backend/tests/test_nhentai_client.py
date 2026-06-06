from app.services.nhentai_client import page_image_url


def test_page_image_url_joins_server_and_path():
    url = page_image_url("https://i.nhentai.net/", {"path": "/galleries/123/1.jpg"})
    assert url == "https://i.nhentai.net/galleries/123/1.jpg"
