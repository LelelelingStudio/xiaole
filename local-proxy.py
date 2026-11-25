#!/usr/bin/env python3
"""本地联调代理：静态文件 + 转发 /api/* 到后端（附合法 Origin），仅用于测试"""
import http.server
import socketserver
import ssl
import http.client
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = "back-xiaole.leleleling.site"
ORIGIN = "https://read.leleleling.site"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if not self.path.startswith("/api/"):
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        path = self.path[len("/api"):]
        ctx = ssl.create_default_context()
        conn = http.client.HTTPSConnection(BACKEND, timeout=90, context=ctx)
        conn.request(
            "POST",
            path,
            body=body,
            headers={
                "Content-Type": "application/json",
                "Origin": ORIGIN,
                "Content-Length": str(len(body)),
            },
        )
        resp = conn.getresponse()

        self.send_response(resp.status)
        self._cors()
        ctype = resp.getheader("Content-Type") or "application/json"
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.end_headers()

        while True:
            chunk = resp.read(256)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()
        conn.close()

    def do_GET(self):
        return super().do_GET()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    print("serving %s on %d" % (ROOT, port))
    Server(("127.0.0.1", port), Handler).serve_forever()
