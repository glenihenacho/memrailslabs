# MemRails Python SDK

Lightweight client for governed memory retrieval. The local agent asks for
memory and receives a governed context bundle — no local DB, no decryption, no
key handling.

```python
from memrails import MemRails

client = MemRails(api_key="...", base_url="http://localhost:3000")

bundle = client.memory.retrieve(
    agent_id="agent_local_001",
    project_id="project_memrails",
    task_context="Detail the technical requirements and roadmap for MemRails.",
    max_tokens=1800,
)

for m in bundle["memories"]:
    print(f"- {m['summary']} (conf {m['confidence']}) — {m['reason_selected']}")

print("branches:", bundle["retrieval_trace"]["branches_selected"])
```

## Install (local / editable)

```bash
cd sdk/python && pip install -e .
```

Requires only the Python standard library (`urllib`). No vector store, no
embeddings, no local index.
