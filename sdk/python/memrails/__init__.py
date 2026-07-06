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

    # Close the loop (C5): feedback fans out to the bundle's memories.
    client.feedback.record(retrieval_id=bundle["retrieval_id"], rating="positive")

Covers the contract v0.1.1 surface: retrieve (all modes; the trace names its
planner), governed writes with validity windows, the full §4 lifecycle
(supersede / dispute / restore / update_confidence / forget), feedback, the
memory map, and §6 export.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, NoReturn, Optional

__all__ = ["MemRails", "MemoryClient", "FeedbackClient"]
__version__ = "0.1.1"


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
        include_disputed: bool = False,
        include_packet: bool = False,
    ) -> dict[str, Any]:
        """memory.retrieve() — the core primitive. Returns a ContextBundle."""
        return self._p._post(
            "/api/memory/retrieve",
            {
                "task_context": task_context,
                "project_id": project_id,
                "agent_id": agent_id,
                "max_tokens": max_tokens,
                "retrieval_mode": retrieval_mode,
                "include_evidence": include_evidence,
                "include_disputed": include_disputed,
                "include_packet": include_packet,
            },
        )

    def write(
        self,
        content: str,
        summary: Optional[str] = None,
        memory_type: str = "note",
        confidence: float = 0.8,
        sensitivity: Optional[str] = None,
        tags: Optional[list[str]] = None,
        project_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        index_path: Optional[str] = None,
        expires_at: Optional[str] = None,
    ) -> dict[str, Any]:
        """Governed write. `expires_at` (ISO 8601) sets a validity window."""
        return self._p._post(
            "/api/memory/write",
            {
                "content": content,
                "summary": summary,
                "memory_type": memory_type,
                "confidence": confidence,
                "sensitivity": sensitivity,
                "tags": tags or [],
                "project_id": project_id,
                "agent_id": agent_id,
                "index_path": index_path,
                "expires_at": expires_at,
            },
        )

    def get(self, memory_id: str) -> dict[str, Any]:
        return self._p._get(f"/api/memory/{urllib.parse.quote(memory_id, safe='')}")

    # ── §4 lifecycle — every transition versioned + evented ─────────────────

    def supersede(
        self,
        memory_id: str,
        new_memory: Optional[dict[str, Any]] = None,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        return self._p._post(
            f"/api/memory/{urllib.parse.quote(memory_id, safe='')}/supersede",
            {"new_memory": new_memory, "reason": reason},
        )

    def dispute(self, memory_id: str, reason: str) -> dict[str, Any]:
        return self._p._post(
            f"/api/memory/{urllib.parse.quote(memory_id, safe='')}/dispute",
            {"reason": reason},
        )

    def restore(
        self,
        memory_id: str,
        reason: Optional[str] = None,
        confidence: Optional[float] = None,
    ) -> dict[str, Any]:
        """§4.4 — dispute is reversible doubt; restore returns it to active."""
        return self._p._post(
            f"/api/memory/{urllib.parse.quote(memory_id, safe='')}/restore",
            {"reason": reason, "confidence": confidence},
        )

    def update_confidence(
        self,
        memory_id: str,
        confidence: float,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        """§4.6 — re-score through a versioned, evented transition."""
        return self._p._post(
            f"/api/memory/{urllib.parse.quote(memory_id, safe='')}/confidence",
            {"confidence": confidence, "reason": reason},
        )

    def forget(self, memory_id: str, reason: Optional[str] = None) -> dict[str, Any]:
        """§4.5 — tombstone: the memory leaves every future bundle."""
        path = f"/api/memory/{urllib.parse.quote(memory_id, safe='')}"
        if reason:
            path += "?reason=" + urllib.parse.quote(reason)
        return self._p._request("DELETE", path)

    # ── Map & export ─────────────────────────────────────────────────────────

    def map(self, project_id: str) -> dict[str, Any]:
        """The project's MemoryIndex as a nested tree."""
        return self._p._get(
            "/api/memory/map?project_id=" + urllib.parse.quote(project_id)
        )

    def export(
        self,
        fmt: str = "json",
        project_id: Optional[str] = None,
    ) -> str:
        """§6 / no lock-in — pull the governed store (json | jsonl | markdown)."""
        params = {"format": fmt}
        if project_id:
            params["project_id"] = project_id
        return self._p._get_text("/api/memory/export?" + urllib.parse.urlencode(params))


class FeedbackClient:
    def __init__(self, parent: "MemRails") -> None:
        self._p = parent

    def record(
        self,
        retrieval_id: str,
        rating: str,
        memory_id: Optional[str] = None,
        feedback_type: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> dict[str, Any]:
        """Rate a retrieval (fans out to its memories) or one memory of it."""
        return self._p._post(
            "/api/feedback",
            {
                "retrieval_id": retrieval_id,
                "rating": rating,
                "memory_id": memory_id,
                "feedback_type": feedback_type,
                "comment": comment,
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
        self.feedback = FeedbackClient(self)

    def _headers(self) -> dict[str, str]:
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        return headers

    def _raise_http_error(self, path: str, err: urllib.error.HTTPError) -> NoReturn:
        # Parity with the TS SDK: surface the status AND the response body
        # (e.g. invalid_input issues, only_disputed_memory_can_be_restored).
        body = err.read().decode(errors="replace")
        raise RuntimeError(f"MemRails {path} failed: {err.code} {body}") from err

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        payload = json.dumps({k: v for k, v in body.items() if v is not None}).encode()
        req = urllib.request.Request(self.base_url + path, data=payload, headers=self._headers())
        try:
            with urllib.request.urlopen(req) as resp:  # noqa: S310 (trusted base_url)
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as err:
            self._raise_http_error(path, err)

    def _request(self, method: str, path: str) -> dict[str, Any]:
        req = urllib.request.Request(self.base_url + path, headers=self._headers(), method=method)
        try:
            with urllib.request.urlopen(req) as resp:  # noqa: S310 (trusted base_url)
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as err:
            self._raise_http_error(path, err)

    def _get(self, path: str) -> dict[str, Any]:
        return self._request("GET", path)

    def _get_text(self, path: str) -> str:
        req = urllib.request.Request(self.base_url + path, headers=self._headers())
        try:
            with urllib.request.urlopen(req) as resp:  # noqa: S310 (trusted base_url)
                return resp.read().decode()
        except urllib.error.HTTPError as err:
            self._raise_http_error(path, err)
