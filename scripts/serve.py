from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SITE_ROOT = PROJECT_ROOT / "site"


class StaticSiteHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".mp3": "audio/mpeg",
        ".png": "image/png",
    }


def main():
    parser = ArgumentParser(description="Preview the calligraphy experiment site.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8080, type=int)
    args = parser.parse_args()

    handler = partial(StaticSiteHandler, directory=str(SITE_ROOT))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Experiment preview: http://{args.host}:{args.port}/")
    print("Close this window or press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
