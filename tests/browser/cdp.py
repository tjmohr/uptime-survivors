"""Minimal Chrome DevTools Protocol client using only the Python standard library.

Used by drive.py for the touch/mobile checks (specs/003-mobile-touch/research.md T8): trusted touch
input, phone-sized device emulation, and CPU throttling. Synthetic in-page events are untrusted and
cannot prove that the page never scrolls or zooms, so these checks drive Chrome from outside.
"""
import base64
import json
import os
import socket
import struct
import time
import urllib.request


class CDPError(RuntimeError):
    pass


class CDP:
    def __init__(self, port, timeout=30):
        self.port = port
        deadline = time.time() + timeout
        target = None
        while time.time() < deadline and target is None:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=2) as r:
                    pages = [t for t in json.load(r) if t.get("type") == "page"]
                    target = pages[0] if pages else None
            except OSError:
                time.sleep(0.2)
        if target is None:
            raise CDPError("no page target")
        self._connect(target["webSocketDebuggerUrl"])
        self._next_id = 0
        self.events = []

    # ---- WebSocket (RFC 6455), client side ----
    def _connect(self, url):
        rest = url.split("://", 1)[1]
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise CDPError("handshake failed")
            head += chunk
        if b" 101 " not in head.split(b"\r\n", 1)[0]:
            raise CDPError("handshake rejected: " + head.split(b"\r\n", 1)[0].decode(errors="replace"))
        self._buf = head.split(b"\r\n\r\n", 1)[1]

    def _send_frame(self, text):
        data = text.encode()
        header = bytearray([0x81])
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(bytes(header) + masked)

    def _read_exact(self, n):
        while len(self._buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise CDPError("connection closed")
            self._buf += chunk
        out, self._buf = self._buf[:n], self._buf[n:]
        return out

    def _recv_message(self):
        parts = []
        while True:
            b0, b1 = self._read_exact(2)
            opcode = b0 & 0x0F
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read_exact(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read_exact(8))[0]
            if b1 & 0x80:
                mask = self._read_exact(4)
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(self._read_exact(n)))
            else:
                payload = self._read_exact(n)
            if opcode == 0x8:
                raise CDPError("connection closed by browser")
            if opcode in (0x9, 0xA):
                continue
            parts.append(payload)
            if b0 & 0x80:
                return b"".join(parts).decode()

    # ---- protocol ----
    def send(self, method, params=None):
        self._next_id += 1
        mid = self._next_id
        self._send_frame(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self._recv_message())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise CDPError(f"{method}: {msg['error'].get('message')}")
                return msg.get("result", {})
            self.events.append(msg)

    def evaluate(self, expr, await_promise=True):
        r = self.send("Runtime.evaluate", {"expression": expr, "awaitPromise": await_promise, "returnByValue": True})
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise CDPError("JS error: " + (d.get("exception", {}).get("description") or d.get("text", "")))
        return r.get("result", {}).get("value")

    def wait_for(self, expr, timeout=10, interval=0.05):
        deadline = time.time() + timeout
        last = None
        while time.time() < deadline:
            try:
                last = self.evaluate(expr)
                if last:
                    return last
            except CDPError:
                pass
            time.sleep(interval)
        raise CDPError(f"timed out waiting for: {expr} (last {last!r})")

    def set_device(self, width, height, mobile=True, dpr=2, touch=True):
        self.send("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": dpr, "mobile": mobile,
            "screenOrientation": {"type": "portraitPrimary" if height >= width else "landscapePrimary",
                                  "angle": 0 if height >= width else 90}})
        self.send("Emulation.setTouchEmulationEnabled", {"enabled": touch, "maxTouchPoints": 5 if touch else 1})

    def navigate(self, url):
        self.send("Page.enable")
        self.send("Page.navigate", {"url": url})

    def touch(self, kind, points):
        """kind: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel'; points: [(x, y, id), ...]."""
        self.send("Input.dispatchTouchEvent", {
            "type": kind,
            "touchPoints": [{"x": x, "y": y, "id": i, "radiusX": 4, "radiusY": 4, "force": 1} for x, y, i in points]})

    def tap(self, x, y, tid=1, hold=0.05):
        self.touch("touchStart", [(x, y, tid)])
        time.sleep(hold)
        self.touch("touchEnd", [])

    def throttle(self, rate):
        self.send("Emulation.setCPUThrottlingRate", {"rate": rate})

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass
