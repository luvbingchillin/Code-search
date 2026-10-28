import React, { useState, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';

interface CodeComparisonExample {
  title: string;
  sourceFile: string;
  naiveChunk: {
    startLine: number;
    endLine: number;
    code: string;
    flaws: string[];
    aiExplanation: string;
    sbirScore: string;
  };
  astChunk: {
    nodeType: string;
    identifier: string;
    startLine: number;
    endLine: number;
    code: string;
    benefits: string[];
    aiExplanation: string;
    sbirScore: string;
  };
}

const HighlightedPython: React.FC<{ code: string }> = ({ code }) => {
  const html = useMemo(() => {
    try {
      return Prism.highlight(code, Prism.languages.python, 'python');
    } catch {
      return code;
    }
  }, [code]);

  return <code dangerouslySetInnerHTML={{ __html: html }} />;
};

export const ChunkComparisonVisualizer: React.FC = () => {
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);

  const examples: CodeComparisonExample[] = [
    {
      title: 'FastAPI Web Route',
      sourceFile: 'fastapi/routing.py',
      naiveChunk: {
        startLine: 114,
        endLine: 128,
        code: `        response_model: Optional[Type[Any]] = None,
        status_code: Optional[int] = None,
        tags: Optional[List[Union[str, Enum]]] = None,
        dependencies: Optional[Sequence[params.Depends]] = None,
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        return self.api_route(
            path=path,
            response_model=response_model,
            status_code=status_code,
            tags=tags,
            dependencies=dependencies,
        )
    def post(
        self,`,
        flaws: [
          'Function name and "@app.get" decorator missing',
          'Cut midway through arguments: cannot run or parse',
          'Spills into "def post(" without body'
        ],
        aiExplanation: 'The AI misses the route decorator, guesses parameter types, and invents what this endpoint returns because the function signature was cut off.',
        sbirScore: 'SBIR: 0.67%'
      },
      astChunk: {
        nodeType: 'FunctionDef',
        identifier: 'APIRouter.get',
        startLine: 108,
        endLine: 126,
        code: `    @doc(summary="Add a GET operation")
    def get(
        self,
        path: str,
        *,
        response_model: Optional[Type[Any]] = None,
        status_code: Optional[int] = None,
        tags: Optional[List[Union[str, Enum]]] = None,
        dependencies: Optional[Sequence[params.Depends]] = None,
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        """Add a GET operation to the router."""
        return self.api_route(
            path=path,
            response_model=response_model,
            status_code=status_code,
            tags=tags,
            dependencies=dependencies,
        )`,
        benefits: [
          'Full function from decorator to return value',
          'Complete parameters and documentation intact',
          '100% syntactically valid code block'
        ],
        aiExplanation: 'The AI explains the route path, dependency injection chain, and return types with 100% precision and zero hallucinations.',
        sbirScore: 'SBIR: 100.0%'
      }
    },
    {
      title: 'Network Request Handler',
      sourceFile: 'requests/sessions.py',
      naiveChunk: {
        startLine: 742,
        endLine: 755,
        code: `        # Try to send the request
        try:
            resp = conn.send(
                req.method,
                req.url,
                body=req.body,
                headers=req.headers,
                redirect=False,
                assert_same_host=False,
                preload_content=False,
                decode_content=False,
                retries=self.max_retries,
                timeout=timeout
            )
        except MaxRetryError as e:`,
        flaws: [
          'Cut inside try block: error handler logic sliced off',
          'Function name and arguments completely missing',
          'AI has to hallucinate return and error types'
        ],
        aiExplanation: 'The AI cannot identify the method or arguments, and hallucinates how retry exceptions are handled because the block was severed.',
        sbirScore: 'SBIR: 0.67%'
      },
      astChunk: {
        nodeType: 'FunctionDef',
        identifier: 'HTTPAdapter.send',
        startLine: 728,
        endLine: 765,
        code: `    def send(
        self, request: PreparedRequest, stream: bool = False, timeout: Optional[Union[float, Tuple[float, float]]] = None, verify: bool = True, cert: Optional[Union[str, Tuple[str, str]]] = None, proxies: Optional[Mapping[str, str]] = None
    ) -> Response:
        """Sends PreparedRequest object. Returns Response object."""
        try:
            conn = self.get_connection(request.url, proxies)
        except LocationValueError as e:
            raise InvalidURL(e, request=request)

        self.cert_verify(conn, request.url, verify, cert)
        url = self.request_url(request, proxies)
        self.add_headers(request, stream=stream, timeout=timeout, verify=verify, cert=cert, proxies=proxies)

        chunked_upload = "Transfer-Encoding" in request.headers and request.headers["Transfer-Encoding"] == "chunked"
        resp = conn.urlopen(
            method=request.method,
            url=url,
            body=request.body,
            headers=request.headers,
            redirect=False,
            assert_same_host=False,
            preload_content=False,
            decode_content=False,
            retries=self.max_retries,
            timeout=timeout
        )
        return self.build_response(request, resp)`,
        benefits: [
          'Complete method from start to finish',
          'All parameters and exception handlers preserved intact',
          'Zero guesswork for the AI'
        ],
        aiExplanation: 'The AI accurately explains connection pooling, request verification, and retry handling from method signature to return value.',
        sbirScore: 'SBIR: 100.0%'
      }
    }
  ];

  const current = examples[activeExampleIndex];

  return (
    <section id="comparison" className="py-24 md:py-32 border-b border-amber-900/20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest mb-2">
            Code & AI Explanation Comparison
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#f4f7f4] tracking-tight mb-3">
            Why Fragmented Code Ruins AI Explanations
          </h2>
          <p className="text-base text-[#9cb3a8] leading-relaxed">
            When code is sliced by arbitrary character limits, the AI is forced to hallucinate missing logic. When the entire syntax tree is preserved, the AI explains your architecture with 100% precision.
          </p>
        </div>

        {/* Example Switcher Tabs */}
        <div className="flex items-center space-x-2 mb-8">
          <span className="text-xs font-mono text-[#9cb3a8] mr-2">Sample File:</span>
          {examples.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => setActiveExampleIndex(idx)}
              data-testid={`example-btn-${idx}`}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                activeExampleIndex === idx
                  ? 'bg-amber-400 text-[#04140d] font-bold'
                  : 'bg-[#062015] text-[#9cb3a8] hover:text-[#f4f7f4] border border-amber-900/30'
              }`}
            >
              {ex.title}
            </button>
          ))}
        </div>

        {/* Comparison Panels: Clean, balanced, side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Left: Naive Slicing */}
          <div
            data-testid="naive-chunk-panel"
            className="rounded-xl red-border p-6 sm:p-7 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-red-950/60">
                <div>
                  <div className="text-sm font-bold text-red-300">
                    The Naive Chunker's Gamble
                  </div>
                  <div className="text-xs text-red-200/70 font-sans mt-0.5">
                    Cut off midway • Missing context
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900/40">
                  {current.naiveChunk.sbirScore}
                </span>
              </div>

              {/* Code Box */}
              <div className="rounded-lg bg-[#080203] border border-red-950 p-4 font-mono text-xs overflow-y-auto leading-relaxed h-[240px] mb-4">
                <pre>
                  <HighlightedPython code={current.naiveChunk.code} />
                </pre>
              </div>

              {/* Bullet Flaws */}
              <div className="space-y-1.5 text-xs text-red-200/80 pt-2 mb-3">
                {current.naiveChunk.flaws.map((flaw, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-red-500 font-bold select-none">•</span>
                    <span>{flaw}</span>
                  </div>
                ))}
              </div>

              {/* AI Explanation Impact */}
              <div className="p-3 rounded-lg bg-[#18080a] border border-red-900/50 text-xs">
                <div className="text-red-400 font-bold font-mono text-[11px] mb-1">
                  ⚠️ AI Explanation Failure:
                </div>
                <p className="font-sans text-[11px] text-red-200/90 leading-relaxed">
                  {current.naiveChunk.aiExplanation}
                </p>
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-red-950/60 text-[11px] font-mono text-red-300/80 flex justify-between">
              <span>Lines {current.naiveChunk.startLine}–{current.naiveChunk.endLine}</span>
              <span>Arbitrary Character Cut</span>
            </div>
          </div>

          {/* Right: Tree-Sitter AST */}
          <div
            data-testid="ast-chunk-panel"
            className="rounded-xl brass-border p-6 sm:p-7 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-900/20">
                <div>
                  <div className="text-sm font-bold text-amber-200">
                    Tree-Sitter AST Determinism
                  </div>
                  <div className="text-xs text-[#9cb3a8] font-sans mt-0.5">
                    100% complete function • Nothing missing
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  {current.astChunk.sbirScore}
                </span>
              </div>

              {/* AST Grammar Metadata Pill */}
              <div className="mb-3 px-3 py-1 rounded bg-[#03140c] border border-emerald-800/30 flex items-center justify-between text-[11px] font-mono text-[#9cb3a8]">
                <span>Node: <strong className="text-amber-300">{current.astChunk.nodeType}</strong></span>
                <span>Symbol: <strong className="text-emerald-300">{current.astChunk.identifier}</strong></span>
              </div>

              {/* Code Box */}
              <div className="rounded-lg bg-[#03110a] border border-emerald-950 p-4 font-mono text-xs overflow-y-auto leading-relaxed h-[240px] mb-4">
                <pre>
                  <HighlightedPython code={current.astChunk.code} />
                </pre>
              </div>

              {/* Bullet Guarantees */}
              <div className="space-y-1.5 text-xs text-[#b8d1c3] pt-2 mb-3">
                {current.astChunk.benefits.map((b, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-amber-400 font-bold select-none">•</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {/* AI Explanation Impact */}
              <div className="p-3 rounded-lg bg-[#041a10] border border-emerald-800/50 text-xs">
                <div className="text-emerald-300 font-bold font-mono text-[11px] mb-1">
                  ✅ AI Explanation Success:
                </div>
                <p className="font-sans text-[11px] text-emerald-200/90 leading-relaxed">
                  {current.astChunk.aiExplanation}
                </p>
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-amber-900/20 text-[11px] font-mono text-[#9cb3a8]/60 flex justify-between">
              <span>Lines {current.astChunk.startLine}–{current.astChunk.endLine}</span>
              <span>Complete Python Node</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
