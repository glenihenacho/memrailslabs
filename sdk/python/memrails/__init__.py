"""MemRails Python SDK.

Cloud-hosted memory infrastructure for locally inferred agents. The agent asks
for memory and receives a governed context bundle — no local database, no
decryption, no key handling.

    from memrails import MemRails

    client = MemRails(api_key="...")
    bundle = client.memory.retrieve(
        agent_id="agent_local_001",
        project_id="project_memrails",
        task_context="Build the roadmap for MemRails",
        max_tokens=1800,
    )
    for m in bundle["memories"]:
        print(m["summary"], m["confidence"], m["reason_selected"])
"""

from __future__ import annotations

import json
import os
import urllib.request
from typing import Any, Optional

__all__ = ["MemRails", "MemoryClient"]
__version__ = "0.1.0"


class MemoryClient:
    def __init__(self, parent: "MemRails") -> None:
        self._p = parent

    def retrieve(
        self,
        task_context: str,
        project_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        max_tokens: int = 1800,
        retrieval_mode: str = "tree",
        include_evidence: bool = False,
        include_packet: bool = False,
    ) -> dict[str, Any]:
        return self._p._post(
            "/api/memory/retrieve",
            {
                "task_context": task_context,
                "project_id": project_id,
                "agent_id": agent_id,
                "max_tokens": max_tokens,
                "retrieval_mode": retrieval_mode,
                "include_evidence": include_evidence,
                "include_packet": include_packet,
            },
        )

    def write(
        self,
        content: str,
        memory_type: str = "note",
        confidence: float = 0.8,
        tags: Optional[list[str]] = None,
        project_id: Optional[str] = None,
    ) -> dict[str, Any]:
        return self._p._post(
            "/api/memory/write",
            {
                "content": content,
                "memory_type": memory_type,
                "confidence": confidence,
                "tags": tags or [],
                "project_id": project_id,
            },
        )


class MemRails:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "http://localhost:3000",
    ) -> None:
        if not base_url.startswith(("http://", "https://")):
            raise ValueError("base_url must use http:// or https://")
        self.api_key = api_key or os.environ.get("MEMRAILS_API_KEY")
        self.base_url = base_url.rstrip("/")
        self.memory = MemoryClient(self)

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        payload = json.dumps({k: v for k, v in body.items() if v is not None}).encode()
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(self.base_url + path, data=payload, headers=headers)
        with urllib.request.urlopen(req) as resp:  # noqa: S310 (trusted base_url)
            return json.loads(resp.read().decode())
