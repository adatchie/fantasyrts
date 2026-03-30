"""
開発用HTTPサーバー（キャッシュ無効化版）
使い方: python server.py
http://localhost:8000/ でアクセス
"""
import http.server
import socketserver

PORT = 8000

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # 静音モード（必要なら super().log_message(format, *args) に戻す）
        pass

with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"サーバー起動: http://localhost:{PORT}/")
    print("停止: Ctrl+C")
    httpd.serve_forever()
