# Benchmark Evaluation: Tree-Sitter AST vs. Naive Text Chunking

Empirical comparison of the proposed **Tree-sitter Python AST Ingestion Engine** against the industry-standard **Naive Sliding Window Chunking baseline** (LangChain Recursive Splitter style).

## 1. Executive Summary

| Metric | Naive Sliding Window (Baseline) | Tree-Sitter AST (Proposed) | Absolute Improvement |
| :--- | :---: | :---: | :---: |
| **Recall@1** | 43.33% | **46.67%** | +3.34% |
| **Recall@3** | 66.67% | **70.00%** | +3.33% |
| **Recall@5** | 73.33% | **76.67%** | +3.34% |
| **Mean Reciprocal Rank (MRR)** | 0.5522 | **0.5833** | +5.6% |
| **Semantic Boundary Integrity (SBIR)** | 0.67% | **100.00%** | **+99.33% (Complete Nodes)** |
| **Average Query Latency** | 21.94 ms | **24.15 ms** | -2.21 ms |

## 2. Analysis of the Three Critical Baseline Flaws

### Flaw 1: Semantic Fragmentation (Eliminated by Tree-Sitter)
- **Naive Chunker SBIR:** `0.67%`. Out of 150 retrieved chunks, only 1 were syntactically valid code blocks. Over 99.3% of chunks cut midway through function signatures, conditional branches, or docstrings, creating severe hallucination hazards.
- **Tree-Sitter AST SBIR:** `100.00%`. 100% of retrieved chunks represent structurally whole `FunctionDef`, `AsyncFunctionDef`, or `ClassDef` nodes, ensuring clean execution and exact line alignment in the code viewer.

### Flaw 2: Retrieval Precision & Ranking (MRR)
- Tree-Sitter AST achieved an MRR of **0.5833** vs. **0.5522** for naive chunking.
- Preserving decorator headers (e.g. `@app.get`, `@property`) and docstrings directly within the symbol's scope prevents semantic dilution during embedding.

## 3. Query Category Performance Breakdown

| Query Category | System | Recall@1 | Recall@3 | Recall@5 | MRR |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Architectural Flow** | Naive Baseline | 40.0% | 50.0% | 70.0% | 0.4900 |
| | **Tree-Sitter AST** | **40.0%** | **60.0%** | **70.0%** | **0.5250** |
| **Entity Locating** | Naive Baseline | 30.0% | 60.0% | 60.0% | 0.4333 |
| | **Tree-Sitter AST** | **40.0%** | **70.0%** | **70.0%** | **0.5167** |
| **Utility Logic** | Naive Baseline | 60.0% | 90.0% | 90.0% | 0.7333 |
| | **Tree-Sitter AST** | **60.0%** | **80.0%** | **90.0%** | **0.7083** |

## 4. Query-Level Audit Table

| ID | Query | Target File | Naive Rank | AST Rank | Status |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Q01 | Where is the main entrypoint function for sending HTTP GET requests? | `api.py` | >5 | **1** | AST Higher |
| Q02 | Where is the core Session.send method defined and how does it delegate to adapters? | `sessions.py` | 2 | **>5** | Naive Higher |
| Q03 | Where is the HTTPAdapter connection pool manager initialized? | `adapters.py` | 1 | **1** | Tie |
| Q04 | Where is CaseInsensitiveDict defined and how does it store case-insensitive keys? | `structures.py` | 1 | **1** | Tie |
| Q05 | Where is the basic auth header encoding string helper function? | `_internal_utils.py` | >5 | **>5** | Tie |
| Q06 | Where is the JSON decoding method on the HTTP Response object implemented? | `models.py` | >5 | **3** | AST Higher |
| Q07 | Where is the cookie extraction from response headers to a cookiejar defined? | `cookies.py` | >5 | **1** | AST Higher |
| Q08 | Where is the Session mount method for registering transport adapters? | `sessions.py` | 1 | **3** | Naive Higher |
| Q09 | Where is the system diagnostic and environment info function implemented? | `help.py` | 3 | **>5** | Naive Higher |
| Q10 | Where is the streaming content generator iter_content defined on Response? | `models.py` | 2 | **2** | Tie |
| Q11 | How does Session.get_adapter select the appropriate transport adapter for a given URL? | `sessions.py` | 1 | **1** | Tie |
| Q12 | How does the SessionRedirectMixin resolve HTTP 3xx redirects and generate the next request? | `sessions.py` | 1 | **2** | Naive Higher |
| Q13 | How does PreparedRequest assemble and validate the full target URL including query parameters? | `sessions.py` | >5 | **>5** | Tie |
| Q14 | How does HTTPAdapter.send execute the request using urllib3 and handle connection retries? | `adapters.py` | >5 | **1** | AST Higher |
| Q15 | How are authentication credentials prepared and attached to a PreparedRequest? | `sessions.py` | 5 | **2** | AST Higher |
| Q16 | How does HTTPAdapter construct a Requests Response object from an underlying urllib3 response? | `adapters.py` | 1 | **1** | Tie |
| Q17 | How are cookies converted and formatted into request headers during request preparation? | `sessions.py` | 5 | **4** | AST Higher |
| Q18 | How does HTTPDigestAuth calculate and construct the Digest challenge response header? | `cookies.py` | >5 | **>5** | Tie |
| Q19 | How does HTTPBasicAuth implement the callable interface to attach authentication to requests? | `sessions.py` | 2 | **>5** | Naive Higher |
| Q20 | How does PreparedRequest.prepare orchestrate the preparation of method, url, headers, auth, and cookies? | `models.py` | 1 | **1** | Tie |
| Q21 | How does super_len calculate the total byte length of files, streams, and iterators? | `utils.py` | 1 | **1** | Tie |
| Q22 | How does should_bypass_proxies check if a URL matches no_proxy environment patterns? | `utils.py` | 2 | **3** | Naive Higher |
| Q23 | How does dispatch_hook invoke registered callback functions for request events? | `models.py` | >5 | **>5** | Tie |
| Q24 | How is an exception raised when an HTTP response contains a 4xx or 5xx status code? | `adapters.py` | 3 | **4** | Naive Higher |
| Q25 | How are netrc credentials retrieved for a specific host from the user's home directory? | `utils.py` | 1 | **1** | Tie |
| Q26 | How does requote_uri normalize and percent-encode an unquoted URI? | `utils.py` | 1 | **1** | Tie |
| Q27 | How is a dictionary of key-value cookie pairs converted into a RequestsCookieJar? | `utils.py` | 1 | **2** | Naive Higher |
| Q28 | How does unquote_header_value strip surrounding quotes from header parameters? | `utils.py` | 1 | **1** | Tie |
| Q29 | How does CaseInsensitiveDict provide lower-cased item iteration for header lookups? | `structures.py` | 2 | **1** | AST Higher |
| Q30 | How does Session.close release connection pools and cleanup adapters? | `sessions.py` | 1 | **1** | Tie |

---
*Generated automatically by `benchmark/run_retrieval_benchmark.py` for the FYP Dissertation Chapter 6 & Supervisor / Alex (NemoIR) Review.*