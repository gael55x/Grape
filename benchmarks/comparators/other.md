# Other comparators (capability matrix)

Tools included in the capability matrix unless a dedicated `comparators/<name>.md` exists.

| Tool | Benchmark decision | Reason |
| --- | --- | --- |
| Graphiti | capability matrix only | Temporal KG + LLM + graph DB; not coding-agent transport |
| Mem0 | capability matrix only | General memory layer; cloud/vector deps |
| Cognee | capability matrix only | Cognify ingestion pipeline is not live repo compile |
| Zep | capability matrix only | Primary path is Zep Cloud |
| Letta | benchmark partially | Session memory persistence only |
| LangChain memory | exclude | Framework primitive, deprecated classic APIs |
| LlamaIndex memory | exclude | Framework module only |

See [`../design.md`](../design.md) and the readiness report capability matrix.
