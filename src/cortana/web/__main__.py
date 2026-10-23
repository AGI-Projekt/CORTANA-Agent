"""Run the local browser prototype with Uvicorn."""
from __future__ import annotations
import os
import sys

def main() -> int:
    try:
        import uvicorn
    except ImportError:
        print('Install web dependencies with python -m pip install -e ".[web]"', file=sys.stderr)
        return 2
    host = os.getenv("CORTANA_API_HOST", "127.0.0.1")
    port = int(os.getenv("CORTANA_API_PORT", "8000"))
    if host not in {"127.0.0.1", "localhost", "::1"}:
        print("Warning: this prototype has no authentication. Binding beyond loopback is unsafe.", file=sys.stderr)
    uvicorn.run("cortana.web.app:create_app", factory=True, host=host, port=port, reload=False)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
