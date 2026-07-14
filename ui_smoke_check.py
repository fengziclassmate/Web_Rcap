from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:3014", wait_until="networkidle")
    if errors:
        raise RuntimeError("Browser page errors: " + " | ".join(errors))
    print("Browser smoke check passed")
    browser.close()
