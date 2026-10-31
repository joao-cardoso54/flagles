"""Servidor local para desenvolvimento: igual ao `python3 -m http.server`, mas sem cache no browser.
Uso: python3 tools/dev-server.py [porta]   (por defeito 8001, na pasta do projeto)"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
http.server.ThreadingHTTPServer(("0.0.0.0", port), NoCache).serve_forever()
